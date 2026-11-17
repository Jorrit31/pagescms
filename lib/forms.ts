/**
 * Webstudio: forms on a client's website (contact form, quote request, ...).
 *
 * The website posts to /api/forms/<owner>/<repo>/<form>. We keep the message
 * in the database (so it shows under "Berichten" in the CMS) and mail it to the
 * client. Which forms a site has, and who gets the mail, comes from .pages.yml:
 *
 *   forms:
 *     - name: contact
 *       label: Contactformulier
 *       to: [info@bakkerij.nl]        # optional, default: everyone invited to the site
 *       subject: Nieuwe aanvraag      # optional
 *       redirect: /bedankt/           # optional, page to show after sending (without JavaScript)
 *
 * Without a `forms` list a site still gets one form called "contact", so a new
 * site needs no setup.
 */

import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { collaboratorTable, configTable, formSubmissionTable, siteSettingTable } from "@/db/schema";

import { getSiteForms, isEmail, MESSAGES_PERMISSION, siteDeclaresForms, type SiteForm } from "@/lib/forms-shared";

export { getSiteForms, isEmail, MESSAGES_PERMISSION, siteDeclaresForms, type SiteForm };

export type SubmissionField = { name: string; label: string; value: string };

const MAX_FIELDS = 30;
const MAX_VALUE = 5000;
const MAX_TOTAL = 20000;

/**
 * The config of the live website, without a signed-in user. Prefers the
 * published branch over the "concept" branch.
 */
export const getPublicSiteConfig = async (owner: string, repo: string) => {
  const rows = await db.query.configTable.findMany({
    where: and(
      sql`lower(${configTable.owner}) = lower(${owner})`,
      sql`lower(${configTable.repo}) = lower(${repo})`,
    ),
    orderBy: [desc(configTable.lastCheckedAt)],
  });
  if (rows.length === 0) return null;
  const row = rows.find((item) => item.branch !== "concept") ?? rows[0];
  let object: any = {};
  try {
    object = JSON.parse(row.object);
  } catch {
    object = {};
  }
  return { owner: row.owner, repo: row.repo, branch: row.branch, object };
};

const humanize = (name: string) => {
  const text = name.replace(/[-_]+/g, " ").trim();
  if (!text) return name;
  if (/^e ?mail$/i.test(text)) return "E-mail";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Turns the posted form into a list of fields. Names starting with "_" are
 * ours (honeypot, timing, page), files are ignored.
 */
export const readSubmittedFields = (entries: Iterable<[string, unknown]>) => {
  const fields: SubmissionField[] = [];
  const meta: Record<string, string> = {};
  let total = 0;

  for (const [rawName, rawValue] of entries) {
    if (typeof rawValue !== "string") continue;
    const name = String(rawName).trim().slice(0, 60);
    if (!name) continue;
    if (name.startsWith("_") || name === "cf-turnstile-response") {
      meta[name] = rawValue.slice(0, 2000);
      continue;
    }
    const value = rawValue.replace(/\r\n/g, "\n").trim().slice(0, MAX_VALUE);
    const existing = fields.find((field) => field.name === name);
    if (existing) {
      if (value) existing.value = existing.value ? `${existing.value}, ${value}` : value;
    } else {
      if (fields.length >= MAX_FIELDS) continue;
      fields.push({ name, label: humanize(name), value });
    }
    total += value.length;
    if (total > MAX_TOTAL) throw new Error("too-long");
  }

  return { fields, meta };
};

/** An e-mail address to reply to: from a field like "email" or "contact". */
export const findReplyTo = (fields: SubmissionField[]) => {
  const preferred = fields.filter((field) => /mail|contact/i.test(field.name));
  for (const field of [...preferred, ...fields]) {
    const value = field.value.trim();
    if (isEmail(value)) return value;
  }
  return undefined;
};

/** Everyone invited to edit this site: they get the mail when `to` is empty. */
export const getSiteClientEmails = async (owner: string, repo: string) => {
  const rows = await db
    .select({ email: collaboratorTable.email })
    .from(collaboratorTable)
    .where(and(
      sql`lower(${collaboratorTable.owner}) = lower(${owner})`,
      sql`lower(${collaboratorTable.repo}) = lower(${repo})`,
    ));
  return Array.from(new Set(rows.map((row) => row.email.trim().toLowerCase()).filter(isEmail)));
};

export const hashIp = async (ip: string) => {
  const secret = process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "";
  const data = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** Max 5 messages per 10 minutes from one visitor to one site. */
export const isRateLimited = async (owner: string, repo: string, ipHash: string) => {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(formSubmissionTable)
    .where(and(
      sql`lower(${formSubmissionTable.owner}) = lower(${owner})`,
      sql`lower(${formSubmissionTable.repo}) = lower(${repo})`,
      sql`${formSubmissionTable.ipHash} = ${ipHash}`,
      gte(formSubmissionTable.createdAt, since),
    ));
  return (row?.count ?? 0) >= 5;
};

export const verifyTurnstile = async (token: string | undefined, ip: string | null) => {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    if (ip) body.append("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const result = await response.json() as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
};

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

export const renderSubmissionEmail = ({
  siteName,
  formLabel,
  fields,
  page,
  inboxUrl,
}: {
  siteName: string;
  formLabel: string;
  fields: SubmissionField[];
  page?: string;
  inboxUrl?: string;
}) => {
  const rows = fields
    .filter((field) => field.value)
    .map((field) => `
      <tr>
        <td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280;white-space:nowrap">${escapeHtml(field.label)}</td>
        <td style="padding:8px 0;vertical-align:top;color:#111827;white-space:pre-wrap">${escapeHtml(field.value)}</td>
      </tr>`)
    .join("");

  const html = `<!doctype html>
<html lang="nl"><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:12px;padding:24px">
      <p style="margin:0 0 4px;color:#6b7280;font-size:13px">${escapeHtml(siteName)} · ${escapeHtml(formLabel)}</p>
      <h1 style="margin:0 0 16px;font-size:20px;color:#111827">Nieuw bericht via je website</h1>
      <table style="border-collapse:collapse;width:100%">${rows}</table>
      ${page ? `<p style="margin:16px 0 0;color:#6b7280;font-size:13px">Verstuurd vanaf ${escapeHtml(page)}</p>` : ""}
      <p style="margin:16px 0 0;color:#6b7280;font-size:13px">Je kunt direct op deze mail antwoorden als de afzender een e-mailadres heeft ingevuld.</p>
      ${inboxUrl ? `<p style="margin:20px 0 0"><a href="${escapeHtml(inboxUrl)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Alle berichten bekijken</a></p>` : ""}
    </div>
  </div>
</body></html>`;

  const text = [
    `Nieuw bericht via je website (${siteName}, ${formLabel})`,
    "",
    ...fields.filter((field) => field.value).map((field) => `${field.label}: ${field.value}`),
    "",
    page ? `Verstuurd vanaf ${page}` : "",
    inboxUrl ? `Alle berichten: ${inboxUrl}` : "",
  ].filter((line, index, all) => line || all[index - 1]).join("\n");

  return { html, text };
};

export type FormMailSetting = { to: string[]; subject?: string };

/** Mail settings Jorrit made in the CMS (Medewerkers > Formulieren), per form name. */
export const getFormMailSettings = async (owner: string, repo: string): Promise<Record<string, FormMailSetting>> => {
  const row = await db.query.siteSettingTable.findFirst({
    where: and(
      sql`lower(${siteSettingTable.owner}) = lower(${owner})`,
      sql`lower(${siteSettingTable.repo}) = lower(${repo})`,
    ),
  });
  const forms = (row?.data as any)?.forms;
  if (!forms || typeof forms !== "object") return {};
  const result: Record<string, FormMailSetting> = {};
  for (const [name, value] of Object.entries(forms as Record<string, any>)) {
    const to = Array.isArray(value?.to) ? value.to.filter((item: unknown): item is string => typeof item === "string" && isEmail(item)) : [];
    const subject = typeof value?.subject === "string" && value.subject.trim() ? value.subject.trim() : undefined;
    result[name] = { to, subject };
  }
  return result;
};

export const saveFormMailSettings = async (owner: string, repo: string, forms: Record<string, FormMailSetting>) => {
  const existing = await db.query.siteSettingTable.findFirst({
    where: and(
      sql`lower(${siteSettingTable.owner}) = lower(${owner})`,
      sql`lower(${siteSettingTable.repo}) = lower(${repo})`,
    ),
  });
  const data = { ...((existing?.data as any) ?? {}), forms };
  if (existing) {
    await db.update(siteSettingTable).set({ data, updatedAt: new Date() }).where(sql`${siteSettingTable.id} = ${existing.id}`);
  } else {
    await db.insert(siteSettingTable).values({ owner, repo, data });
  }
};
