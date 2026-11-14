/**
 * Brand shown to clients: the name in the browser tab, on the sign-in page
 * and in emails. Set NEXT_PUBLIC_BRAND_NAME to change it. Replace
 * app/icon.svg and public/images/email-logo.png for another logo.
 *
 * Links to terms and privacy only show when their URL is set. The "Need
 * help?" button mails NEXT_PUBLIC_BRAND_SUPPORT_EMAIL (hidden when empty).
 */

export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Webstudio Jorrit",
  description: process.env.NEXT_PUBLIC_BRAND_DESCRIPTION?.trim() || "Beheer de inhoud van je website.",
  termsUrl: process.env.NEXT_PUBLIC_BRAND_TERMS_URL?.trim() || "",
  privacyUrl: process.env.NEXT_PUBLIC_BRAND_PRIVACY_URL?.trim() || "",
  supportEmail: process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL?.trim() || "",
};
