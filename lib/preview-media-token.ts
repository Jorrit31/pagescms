/**
 * Signed links for images in the live preview.
 *
 * The preview page runs on the website's own domain, so it can't use the
 * editor's login cookie, and raw.githubusercontent.com doesn't work for
 * private repositories. Instead the editor gets a signed token that allows
 * reading files in the media folders of one repository and branch, for a
 * limited time, via /api/preview-media/<token>/<path>.
 */

type PreviewMediaClaims = {
  o: string; // owner
  r: string; // repo
  b: string; // branch
  p: string[]; // allowed folders (media inputs)
  e: number; // expiry, seconds since epoch
};

const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

const getKey = async () => {
  const secret = process.env.CRYPTO_KEY;
  if (!secret) throw new Error("Crypto key is not set.");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`preview-media:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
};

const createPreviewMediaToken = async (claims: Omit<PreviewMediaClaims, "e">) => {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({
    ...claims,
    e: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
  })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await getKey(), new TextEncoder().encode(payload)));
  return `${payload}.${toBase64Url(signature)}`;
};

const verifyPreviewMediaToken = async (token: string): Promise<PreviewMediaClaims | null> => {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as PreviewMediaClaims;
    if (typeof claims.e !== "number" || claims.e < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
};

/** Is this path inside one of the allowed media folders (and not escaping it)? */
const isAllowedMediaPath = (path: string, folders: string[]) => {
  if (!path || path.split("/").some((part) => part === ".." || part === ".")) return false;
  return folders.some((folder) => {
    const clean = folder.replace(/^\/+|\/+$/g, "");
    return clean === "" || path.startsWith(`${clean}/`);
  });
};

export { createPreviewMediaToken, verifyPreviewMediaToken, isAllowedMediaPath };
