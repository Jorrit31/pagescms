import { type NextRequest } from "next/server";
import { db } from "@/db";
import { formSubmissionTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmail } from "@/lib/mailer";
import {
  findReplyTo,
  getFormMailSettings,
  getPublicSiteConfig,
  getSiteClientEmails,
  getSiteForms,
  hashIp,
  isRateLimited,
  readSubmittedFields,
  renderSubmissionEmail,
  verifyTurnstile,
} from "@/lib/forms";

/**
 * A form on a client's website posts here (public, no login).
 *
 * POST /api/forms/<owner>/<repo>/<form>
 *
 * Works with a plain HTML form (we send the visitor back to the page with
 * ?verzonden=1) and with fetch() (send Accept: application/json, get JSON).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

type Outcome = { ok: true } | { ok: false; status: number; error: string };

const messages: Record<string, string> = {
  "not-found": "Dit formulier bestaat niet (meer).",
  "empty": "Vul het formulier in voordat je het verstuurt.",
  "too-long": "Je bericht is te lang.",
  "too-many": "Je hebt net al een paar berichten gestuurd. Probeer het over een paar minuten nog eens.",
  "spam-check": "De controle tegen spam is niet gelukt. Probeer het nog een keer.",
  "error": "Versturen is niet gelukt. Probeer het later nog eens of neem op een andere manier contact op.",
};

const wantsJson = (request: NextRequest) => {
  const accept = request.headers.get("accept") || "";
  const type = request.headers.get("content-type") || "";
  return accept.includes("application/json") || type.includes("application/json");
};

const pageFromReferer = (request: NextRequest, meta: Record<string, string>) => {
  const candidate = meta._pagina || request.headers.get("referer") || "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
};

const thankYouPage = (ok: boolean, text: string, back: string | null) => new Response(
  `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? "Verstuurd" : "Niet verstuurd"}</title>
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f5f5f4;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111827}main{background:#fff;border-radius:12px;padding:32px 24px;max-width:420px;margin:16px;text-align:center}a{color:inherit}</style></head>
<body><main><h1 style="font-size:22px;margin:0 0 8px">${ok ? "Bedankt, je bericht is verstuurd" : "Niet verstuurd"}</h1><p style="margin:0 0 16px">${text}</p>${back ? `<p style="margin:0"><a href="${back.replace(/"/g, "&quot;")}">Terug naar de website</a></p>` : ""}</main></body></html>`,
  { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string; form: string }> },
) {
  const params = await context.params;
  const json = wantsJson(request);
  let meta: Record<string, string> = {};
  let redirectTo: string | null = null;

  const respond = (outcome: Outcome) => {
    if (json) {
      return Response.json(
        outcome.ok ? { ok: true } : { ok: false, error: messages[outcome.error] ?? messages.error },
        { status: outcome.ok ? 200 : outcome.status, headers: corsHeaders },
      );
    }
    const page = pageFromReferer(request, meta);
    if (outcome.ok && redirectTo) {
      return new Response(null, { status: 303, headers: { Location: redirectTo } });
    }
    if (page) {
      page.searchParams.set(outcome.ok ? "verzonden" : "fout", outcome.ok ? "1" : outcome.error);
      return new Response(null, { status: 303, headers: { Location: page.toString() } });
    }
    return thankYouPage(outcome.ok, outcome.ok ? "We nemen zo snel mogelijk contact met je op." : (messages[outcome.error] ?? messages.error), null);
  };

  try {
    const site = await getPublicSiteConfig(params.owner, params.repo);
    const form = site ? getSiteForms(site.object).find((item) => item.name === params.form) : null;
    if (!site || !form) return respond({ ok: false, status: 404, error: "not-found" });

    let entries: Iterable<[string, unknown]>;
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const body = await request.json().catch(() => null);
      entries = body && typeof body === "object" && !Array.isArray(body)
        ? Object.entries(body).map(([key, value]) => [key, typeof value === "number" || typeof value === "boolean" ? String(value) : value] as [string, unknown])
        : [];
    } else {
      const formData = await request.formData();
      entries = formData.entries() as Iterable<[string, unknown]>;
    }

    let parsed: ReturnType<typeof readSubmittedFields>;
    try {
      parsed = readSubmittedFields(entries);
    } catch {
      return respond({ ok: false, status: 413, error: "too-long" });
    }
    meta = parsed.meta;
    const fields = parsed.fields;

    // Where to send the visitor after a plain (non-JavaScript) post.
    if (form.redirect) {
      const base = pageFromReferer(request, meta);
      try {
        redirectTo = new URL(form.redirect, base ?? undefined).toString();
      } catch {
        redirectTo = null;
      }
    }

    // Spam: a hidden field that people leave empty, and bots that post
    // faster than anyone can type. Both look like success to the bot.
    const honeypot = (meta._gotcha || meta._website || "").trim();
    const startedAt = Number(meta._t);
    const tooFast = Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 2500;
    if (honeypot || tooFast) return respond({ ok: true });

    if (!fields.some((field) => field.value)) return respond({ ok: false, status: 400, error: "empty" });

    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ipHash = ip ? await hashIp(ip) : null;
    if (ipHash && await isRateLimited(site.owner, site.repo, ipHash)) {
      return respond({ ok: false, status: 429, error: "too-many" });
    }

    const turnstileToken = meta["cf-turnstile-response"];
    if ((form.turnstile || turnstileToken) && !(await verifyTurnstile(turnstileToken, ip))) {
      return respond({ ok: false, status: 400, error: "spam-check" });
    }

    const replyTo = findReplyTo(fields);
    const page = pageFromReferer(request, meta);
    const pageText = page ? `${page.origin}${page.pathname}` : null;

    const [saved] = await db.insert(formSubmissionTable).values({
      owner: site.owner,
      repo: site.repo,
      form: form.name,
      fields,
      email: replyTo ?? null,
      page: pageText,
      ipHash,
    }).returning({ id: formSubmissionTable.id });

    // The message is safe in the database; a failing mail must not fail the visitor.
    try {
      // Who gets the mail: set in the CMS (Medewerkers > Formulieren), else .pages.yml, else the invited clients.
      const setting = (await getFormMailSettings(site.owner, site.repo))[form.name];
      const recipients = setting?.to.length
        ? setting.to
        : form.to.length > 0 ? form.to : await getSiteClientEmails(site.owner, site.repo);
      const subject = setting?.subject || form.subject;
      if (recipients.length > 0) {
        let inboxUrl: string | undefined;
        try {
          inboxUrl = `${getBaseUrl()}/${site.owner}/${site.repo}/${encodeURIComponent(site.branch)}/berichten`;
        } catch {
          inboxUrl = undefined;
        }
        const siteName = (typeof site.object?.settings?.name === "string" && site.object.settings.name.trim()) || site.repo;
        const { html, text } = renderSubmissionEmail({
          siteName,
          formLabel: form.label,
          fields,
          page: pageText ?? undefined,
          inboxUrl,
        });
        await sendEmail({
          to: recipients,
          subject: subject || `Nieuw bericht via je website: ${form.label}`,
          html,
          text,
          replyTo,
        });
        await db.update(formSubmissionTable).set({ mailed: true }).where(eq(formSubmissionTable.id, saved.id));
      }
    } catch (error) {
      console.error("Form mail failed", error);
    }

    return respond({ ok: true });
  } catch (error) {
    console.error(error);
    return respond({ ok: false, status: 500, error: "error" });
  }
}
