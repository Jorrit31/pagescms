/**
 * Webstudio: writing help ("Schrijfhulp") with Cloudflare Workers AI.
 *
 * It must never cost anything. Workers AI gives every Cloudflare account
 * 10,000 "neurons" a day for free (Free and Paid plan alike, reset at 00:00
 * UTC). On the Free plan Cloudflare stops by itself after that; on the Paid
 * plan it would start billing ($0.011 per 1,000 neurons). So we keep our own
 * hard cap below the free amount:
 *
 * - Before each request we reserve the worst case (the most input and output
 *   the request can have) in the ai_usage table, in one SQL statement that
 *   refuses when the cap would be passed. Many people clicking at once can't
 *   push it over either.
 * - After the answer we replace the reservation by what was really used
 *   (Workers AI reports the tokens), so unused room comes back.
 * - Each site also has its own daily cap, so one busy client can't use up the
 *   help for everyone.
 * - When Cloudflare itself says the free allowance is used up, the day is
 *   marked full.
 *
 * Settings (Cloudflare dashboard, Worker "beheerscherm", Variables):
 * - AI_ACCOUNT_ID   your Cloudflare account ID
 * - AI_API_TOKEN    a Workers AI API token (dashboard: AI > Workers AI > Use REST API) (secret)
 * - AI_DAILY_NEURONS       cap for all sites together (default 9000, max 9500)
 * - AI_SITE_DAILY_NEURONS  cap per site (default 3000)
 * - AI_MODEL               model (default @cf/google/gemma-4-26b-a4b-it)
 * Without AI_ACCOUNT_ID and AI_API_TOKEN (or an "AI" binding) the help is off
 * and its buttons stay hidden.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsageTable } from "@/db/schema";
import { createHttpError } from "@/lib/api-error";

const FREE_NEURONS_PER_DAY = 10_000;
const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";

// Neurons per million tokens [input, output], from
// https://developers.cloudflare.com/workers-ai/platform/pricing/ (2026-11).
// An unknown model is counted at the most expensive rate we know.
const RATES: Record<string, [number, number]> = {
  "@cf/google/gemma-4-26b-a4b-it": [9091, 27273],
  "@cf/google/gemma-3-12b-it": [31371, 50560],
  "@cf/mistralai/mistral-small-3.1-24b-instruct": [31876, 50488],
  "@cf/meta/llama-3.1-8b-instruct-fp8": [13778, 26128],
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": [26668, 204805],
};
const WORST_RATE: [number, number] = [31876, 204805];

// Longest text we send. About 4,000 tokens; longer texts are refused.
export const AI_MAX_CHARS = 12_000;
// A photo is sent small (512 px); count it as this many input tokens.
const IMAGE_TOKENS = 1_200;
// Instructions around the text.
const PROMPT_TOKENS = 400;

const intEnv = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const aiLimits = () => {
  const total = Math.min(intEnv("AI_DAILY_NEURONS", 9_000), FREE_NEURONS_PER_DAY - 500);
  const site = Math.min(intEnv("AI_SITE_DAILY_NEURONS", 3_000), total);
  return { total, site };
};

const model = () => process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
const rate = () => RATES[model()] ?? WORST_RATE;

type AiBinding = { run: (model: string, input: unknown) => Promise<unknown> };

const getBinding = (): AiBinding | null => {
  const context = (globalThis as Record<symbol, { env?: { AI?: AiBinding } } | undefined>)[Symbol.for("__cloudflare-context__")];
  const binding = context?.env?.AI;
  return binding && typeof binding.run === "function" ? binding : null;
};

export const isAiEnabled = () =>
  Boolean(getBinding() || (process.env.AI_ACCOUNT_ID?.trim() && process.env.AI_API_TOKEN?.trim()));

/** The UTC day Cloudflare counts in. */
export const aiDay = (now = new Date()) => now.toISOString().slice(0, 10);

const TOTAL_SCOPE = "*";
const siteScope = (owner: string, repo: string) => `${owner}/${repo}`.toLowerCase();

const estimateTokens = (text: string) => Math.ceil(text.length / 3);

export const neuronsFor = (inputTokens: number, outputTokens: number) => {
  const [input, output] = rate();
  return Math.ceil((inputTokens * input + outputTokens * output) / 1_000_000);
};

/** Adds `neurons` to a counter, but only while it stays at or below `cap`. */
const tryAdd = async (day: string, scope: string, neurons: number, cap: number): Promise<boolean> => {
  if (neurons > cap) return false;
  const rows = await db.execute(sql`
    insert into ${aiUsageTable} (day, scope, neurons, requests)
    values (${day}, ${scope}, ${neurons}, 1)
    on conflict (day, scope) do update
      set neurons = ${aiUsageTable.neurons} + excluded.neurons,
          requests = ${aiUsageTable.requests} + 1
      where ${aiUsageTable.neurons} + excluded.neurons <= ${cap}
    returning neurons
  `);
  return Array.from(rows as Iterable<unknown>).length > 0;
};

const adjust = async (day: string, scope: string, delta: number, requests = 0) => {
  if (!delta && !requests) return;
  await db
    .update(aiUsageTable)
    .set({
      neurons: sql`greatest(0, ${aiUsageTable.neurons} + ${delta})`,
      requests: sql`greatest(0, ${aiUsageTable.requests} + ${requests})`,
    })
    .where(and(eq(aiUsageTable.day, day), eq(aiUsageTable.scope, scope)));
};

const markDayFull = async (day: string) => {
  const { total } = aiLimits();
  await db.execute(sql`
    insert into ${aiUsageTable} (day, scope, neurons, requests)
    values (${day}, ${TOTAL_SCOPE}, ${total}, 0)
    on conflict (day, scope) do update set neurons = greatest(${aiUsageTable.neurons}, ${total})
  `);
};

export class AiLimitError extends Error {
  status = 429;
  constructor() {
    super("The writing help has done enough for today. Tomorrow it works again.");
  }
}

/** How much room is left today for this site, 0-100 (for the button). */
export const aiRoomLeft = async (owner: string, repo: string) => {
  const day = aiDay();
  const { total, site } = aiLimits();
  const rows = await db
    .select({ scope: aiUsageTable.scope, neurons: aiUsageTable.neurons })
    .from(aiUsageTable)
    .where(eq(aiUsageTable.day, day));
  const used = (scope: string) => rows.find((row) => row.scope === scope)?.neurons ?? 0;
  const leftTotal = Math.max(0, total - used(TOTAL_SCOPE));
  const leftSite = Math.max(0, site - used(siteScope(owner, repo)));
  const left = Math.min(leftTotal, leftSite);
  return site > 0 ? Math.round((left / site) * 100) : 0;
};

type Message = { role: "system" | "user"; content: string | Array<Record<string, unknown>> };

type RunResult = { text: string; inputTokens?: number; outputTokens?: number };

const isFreeLimitError = (status: number, body: string) =>
  status === 429 || /4006|daily free allocation|neurons|exceeded/i.test(body);

const parseResult = (payload: any): RunResult => {
  const result = payload?.result ?? payload;
  const choice = result?.choices?.[0];
  const raw = typeof result?.response === "string"
    ? result.response
    : typeof choice?.message?.content === "string"
      ? choice.message.content
      : typeof choice?.text === "string"
        ? choice.text
        : "";
  const usage = result?.usage ?? payload?.usage ?? {};
  return {
    text: raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim(),
    inputTokens: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : undefined,
    outputTokens: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : undefined,
  };
};

const callModel = async (messages: Message[], maxTokens: number): Promise<RunResult> => {
  const input = {
    messages,
    max_completion_tokens: maxTokens,
    max_tokens: maxTokens,
    temperature: 0.4,
    // Answer straight away instead of "thinking" first (costs tokens).
    chat_template_kwargs: { enable_thinking: false },
  };
  const binding = getBinding();
  if (binding) {
    try {
      return parseResult(await binding.run(model(), input));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isFreeLimitError(0, message)) throw Object.assign(new Error("free-limit"), { freeLimit: true });
      throw error;
    }
  }
  const account = process.env.AI_ACCOUNT_ID!.trim();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/run/${model()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AI_API_TOKEN!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (isFreeLimitError(response.status, body)) throw Object.assign(new Error("free-limit"), { freeLimit: true });
    console.error("Workers AI error", response.status, body.slice(0, 500));
    throw createHttpError("The writing help isn't working right now. Try again in a moment.", 502);
  }
  return parseResult(await response.json());
};

/**
 * Runs one request within the caps. `outputTokens` is the most the model may
 * write; together with the input it is reserved before the call.
 */
const run = async (
  owner: string,
  repo: string,
  messages: Message[],
  outputTokens: number,
  images = 0,
): Promise<string> => {
  if (!isAiEnabled()) throw createHttpError("The writing help is not switched on.", 404);
  const day = aiDay();
  const { total, site } = aiLimits();
  const text = messages.map((message) => (typeof message.content === "string"
    ? message.content
    : message.content.map((part) => (typeof part.text === "string" ? part.text : "")).join(" "))).join("\n");
  const reservedInput = estimateTokens(text) + PROMPT_TOKENS + images * IMAGE_TOKENS;
  const reserved = neuronsFor(reservedInput, outputTokens);
  const scope = siteScope(owner, repo);

  if (!(await tryAdd(day, TOTAL_SCOPE, reserved, total))) throw new AiLimitError();
  if (!(await tryAdd(day, scope, reserved, site))) {
    await adjust(day, TOTAL_SCOPE, -reserved, -1);
    throw new AiLimitError();
  }

  let result: RunResult;
  try {
    result = await callModel(messages, outputTokens);
  } catch (error) {
    if ((error as { freeLimit?: boolean }).freeLimit) {
      await markDayFull(day);
      throw new AiLimitError();
    }
    // Keep the reservation: we can't be sure nothing was counted.
    throw error;
  }

  // Count what was really used (never less than 1), give the rest back.
  const used = result.inputTokens !== undefined && result.outputTokens !== undefined
    ? Math.max(1, neuronsFor(result.inputTokens, result.outputTokens))
    : reserved;
  const delta = used - reserved;
  if (delta !== 0) {
    await adjust(day, TOTAL_SCOPE, delta);
    await adjust(day, scope, delta);
  }
  if (!result.text) throw createHttpError("The writing help gave no answer. Try again.", 502);
  return result.text;
};

// ---------------------------------------------------------------------------
// The tasks

export const AI_LANGUAGES: Record<string, string> = {
  nl: "Dutch",
  de: "German",
  en: "English",
  fr: "French",
};

export type AiFormat = "plain" | "markdown" | "html";
export type AiRewriteMode = "improve" | "shorter" | "longer" | "inviting";

const FORMAT_RULES: Record<AiFormat, string> = {
  plain: "The text is plain text. Answer with plain text only, no markdown, no quotes around it.",
  markdown: "The text is Markdown. Keep the Markdown structure (headings, lists, links, images) and answer with Markdown only.",
  html: "The text is HTML. Keep every tag, attribute, class, link and image exactly as they are and only change the words between the tags. Answer with the HTML only, no code fences.",
};

const REWRITE_TASKS: Record<AiRewriteMode, string> = {
  improve: "Fix spelling, grammar and punctuation, and make sentences flow better. Keep the meaning, the tone and roughly the same length.",
  shorter: "Make the text clearly shorter (about half) while keeping the important information.",
  longer: "Make the text somewhat longer and richer (about one and a half times), without inventing facts like prices, dates, names or places.",
  inviting: "Make the text warmer and more inviting for customers, without exaggerating and without inventing facts.",
};

const BASE_RULES = "You help a small business owner write texts for their own website. Never add facts that are not in the text (no prices, dates, names, phone numbers or claims). Only output the result, without explanation or introduction.";

const stripFences = (text: string) => text.replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
const stripQuotes = (text: string) => text.replace(/^["'“„«]+|["'”»]+$/g, "").trim();

const tidy = (text: string, format: AiFormat) => {
  const clean = stripFences(text);
  return format === "plain" ? stripQuotes(clean) : clean;
};

const checkLength = (text: string) => {
  if (!text.trim()) throw createHttpError("There is no text yet.", 400);
  if (text.length > AI_MAX_CHARS) throw createHttpError("This text is too long for the writing help.", 400);
};

const outputFor = (text: string, factor = 1.4) => Math.min(4_000, Math.ceil(estimateTokens(text) * factor) + 200);

export const aiRewrite = async (owner: string, repo: string, text: string, mode: AiRewriteMode, format: AiFormat) => {
  checkLength(text);
  const answer = await run(owner, repo, [
    {
      role: "system",
      content: `${BASE_RULES} ${FORMAT_RULES[format]} Always answer in the same language as the text.`,
    },
    { role: "user", content: `${REWRITE_TASKS[mode]}\n\nText:\n${text}` },
  ], outputFor(text, mode === "longer" ? 2 : 1.4));
  return tidy(answer, format);
};

export const aiTranslate = async (owner: string, repo: string, text: string, language: string, format: AiFormat) => {
  checkLength(text);
  const target = AI_LANGUAGES[language];
  if (!target) throw createHttpError("Invalid language.", 400);
  const answer = await run(owner, repo, [
    {
      role: "system",
      content: `${BASE_RULES} ${FORMAT_RULES[format]} Translate the text into natural, fluent ${target}, as a native speaker would write it for a website. Keep names of people, places and the business as they are.`,
    },
    { role: "user", content: text },
  ], outputFor(text, 1.6));
  return tidy(answer, format);
};

export const aiDescribePhoto = async (
  owner: string,
  repo: string,
  image: string,
  language: string,
  context: string,
) => {
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 400_000) {
    throw createHttpError("Invalid photo.", 400);
  }
  const target = AI_LANGUAGES[language] ?? AI_LANGUAGES.nl;
  const about = context.trim().slice(0, 600);
  const answer = await run(owner, repo, [
    {
      role: "system",
      content: `You write alt texts for photos on a small business website, for blind visitors and for Google. Write one short sentence in ${target} (at most 125 characters) that says what is in the photo. Do not start with "Photo of" or "Image of". Only output the sentence.`,
    },
    {
      role: "user",
      content: [
        { type: "text", text: about ? `The photo is used on this part of the website: ${about}` : "Describe this photo." },
        { type: "image_url", image_url: { url: image } },
      ],
    },
  ], 120, 1);
  return stripQuotes(stripFences(answer)).slice(0, 200);
};

export const aiSeo = async (owner: string, repo: string, pageText: string, languages: string[], siteName: string) => {
  const text = pageText.trim().slice(0, 6_000);
  if (!text) throw createHttpError("There is no text on this page yet.", 400);
  const wanted = languages.filter((code) => AI_LANGUAGES[code]).slice(0, 3);
  const single = wanted.length === 0;
  const shape = single
    ? `{"titel": "...", "omschrijving": "..."}`
    : `{${wanted.map((code) => `"${code}": {"titel": "...", "omschrijving": "..."}`).join(", ")}}`;
  const languageRule = single
    ? "Write in the same language as the page text."
    : wanted.map((code) => `"${code}" is ${AI_LANGUAGES[code]}.`).join(" ");
  const answer = await run(owner, repo, [
    {
      role: "system",
      content: `You write the Google title and description for one page of a small business website${siteName ? ` called "${siteName}"` : ""}. The title is what people would search for, with the place if the text mentions one, at most 60 characters. The description is one or two inviting sentences, 120 to 155 characters. Don't invent facts. ${languageRule} Answer with JSON only, exactly in this shape: ${shape}`,
    },
    { role: "user", content: `Text of the page:\n${text}` },
  ], 200 + Math.max(1, wanted.length) * 150);
  const json = stripFences(answer);
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  try {
    const parsed = JSON.parse(json.slice(start, end + 1));
    const clean = (part: any) => ({
      titel: typeof part?.titel === "string" ? stripQuotes(part.titel).slice(0, 90) : "",
      omschrijving: typeof part?.omschrijving === "string" ? stripQuotes(part.omschrijving).slice(0, 220) : "",
    });
    if (single) return { "": clean(parsed) };
    return Object.fromEntries(wanted.map((code) => [code, clean(parsed?.[code])]));
  } catch {
    throw createHttpError("The writing help gave an unclear answer. Try again.", 502);
  }
};
