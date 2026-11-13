/**
 * First-time setup: create the GitHub App from a manifest.
 *
 * https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
 *
 * The setup page asks for BETTER_AUTH_SECRET, so only the person who
 * installed this CMS can connect GitHub. The state sent to GitHub is signed
 * with the same secret, so a manifest code from someone else is refused.
 */

import { getBaseUrl } from "@/lib/base-url";

const STATE_MAX_AGE_MS = 60 * 60 * 1000;

const getSetupSecret = () => (process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || "").trim();

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

const sign = async (value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSetupSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
};

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
};

const isSetupSecret = (value: string) => {
  const secret = getSetupSecret();
  return Boolean(secret) && safeEqual(value.trim(), secret);
};

const createSetupState = async () => {
  const timestamp = Date.now().toString();
  return `${timestamp}.${await sign(`setup:${timestamp}`)}`;
};

const isValidSetupState = async (state: string | null) => {
  if (!state) return false;
  const [timestamp, signature] = state.split(".");
  if (!timestamp || !signature) return false;
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > STATE_MAX_AGE_MS) return false;
  return safeEqual(signature, await sign(`setup:${timestamp}`));
};

const buildManifest = (name: string) => {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  return {
    name,
    url: baseUrl,
    description: "Website content editor.",
    public: false,
    redirect_url: `${baseUrl}/api/setup/github-app/callback`,
    callback_urls: [`${baseUrl}/api/auth/callback/github`],
    setup_url: `${baseUrl}/`,
    setup_on_update: true,
    request_oauth_on_install: false,
    hook_attributes: {
      url: `${baseUrl}/api/webhook/github`,
      active: true,
    },
    default_permissions: {
      administration: "write",
      actions: "write",
      checks: "read",
      statuses: "read",
      contents: "write",
      email_addresses: "read",
      metadata: "read",
    },
    default_events: [
      "installation_target",
      "repository",
      "push",
      "delete",
      "check_run",
      "check_suite",
      "status",
      "workflow_run",
    ],
  };
};

const getManifestFormUrl = (organization: string | null, state: string) => {
  const base = organization
    ? `https://github.com/organizations/${encodeURIComponent(organization)}/settings/apps/new`
    : "https://github.com/settings/apps/new";
  return `${base}?state=${encodeURIComponent(state)}`;
};

export { buildManifest, createSetupState, getManifestFormUrl, isSetupSecret, isValidSetupState };
