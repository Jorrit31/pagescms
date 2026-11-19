/**
 * Webstudio: form settings that both the server and the browser read.
 * See lib/forms.ts for how forms work.
 */

export type SiteForm = {
  name: string;
  label: string;
  to: string[];
  subject?: string;
  redirect?: string;
  turnstile?: boolean;
};

/** Name used in collaborator permissions for "may read Berichten". */
export const MESSAGES_PERMISSION = "_berichten";

const FORM_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/i;
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export const isEmail = (value: string) => value.length <= 254 && EMAIL.test(value);

const asList = (value: unknown): string[] => {
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim());
  return [];
};

/**
 * Newsletter sign-ups ("nieuwsbrief" block on the website). Every site has this
 * form, also when it declares its own `forms`. Sign-ups are not mailed one by
 * one: they gather in Berichten > Nieuwsbrief, where the client downloads the
 * list for MailerLite, Brevo or Mailchimp.
 */
export const NEWSLETTER_FORM = "nieuwsbrief";

const newsletterForm: SiteForm = { name: NEWSLETTER_FORM, label: "Nieuwsbrief", to: [] };

const withNewsletter = (forms: SiteForm[]) => (
  forms.some((form) => form.name === NEWSLETTER_FORM) ? forms : [...forms, newsletterForm]
);

/** The forms a site has, from its (normalized) config object. */
export const getSiteForms = (configObject: any): SiteForm[] => {
  const raw = Array.isArray(configObject?.forms) ? configObject.forms : null;
  if (!raw) return withNewsletter([{ name: "contact", label: "Contactformulier", to: [] }]);
  return withNewsletter(raw
    .filter((item: any) => item && typeof item.name === "string" && FORM_NAME.test(item.name))
    .map((item: any) => ({
      name: item.name,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : item.name,
      to: asList(item.to).filter(isEmail),
      subject: typeof item.subject === "string" && item.subject.trim() ? item.subject.trim() : undefined,
      redirect: typeof item.redirect === "string" && item.redirect.trim() ? item.redirect.trim() : undefined,
      turnstile: item.turnstile === true,
    })));
};

/** True when the site declares forms itself (then "Berichten" always shows). */
export const siteDeclaresForms = (configObject: any) => Array.isArray(configObject?.forms) && configObject.forms.length > 0;


/** Fired in the browser when messages were read or deleted (updates the menu count). */
export const MESSAGES_CHANGED_EVENT = "webstudio:messages-changed";
