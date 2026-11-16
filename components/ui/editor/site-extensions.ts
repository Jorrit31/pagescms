/**
 * Extras for the simple text editor (rich-text field with `options.toolbar`).
 *
 * - SiteStyle: a text style from the website's own design ("Handschrift",
 *   "Opvallend", ...). Stored as <span class="...">; only the classes that the
 *   site's .pages.yml lists are kept, so a client can't add other styling.
 * - SiteRule: a dividing line (<hr>) or empty space (<hr class="ruimte">).
 */
import { Mark, mergeAttributes } from "@tiptap/core";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

export type EditorTextStyle = {
  label: string;
  class: string;
  /** CSS declarations that show the style inside the editor, e.g. "font-family: Georgia". */
  preview?: string;
};

export const SPACE_CLASS = "ruimte";

const CLASS_NAME = /^[a-zA-Z][\w-]*$/;

export const cleanTextStyles = (styles: unknown): EditorTextStyle[] => {
  if (!Array.isArray(styles)) return [];
  const seen = new Set<string>();
  const result: EditorTextStyle[] = [];
  for (const style of styles) {
    if (!style || typeof style !== "object") continue;
    const { label, class: className, preview } = style as Record<string, unknown>;
    if (typeof className !== "string" || !CLASS_NAME.test(className) || seen.has(className)) continue;
    seen.add(className);
    result.push({
      label: typeof label === "string" && label.trim() ? label.trim() : className,
      class: className,
      ...(typeof preview === "string" ? { preview } : {}),
    });
  }
  return result;
};

// Only plain declarations: no braces, no at-rules, no urls, no closing tags.
export const safePreviewCss = (css: string) =>
  /[{}<>@\\]|url\s*\(|expression\s*\(/i.test(css) ? "" : css;

export const SiteStyle = Mark.create<{ classes: string[] }>({
  name: "siteStyle",

  addOptions() {
    return { classes: [] };
  },

  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const found = Array.from(element.classList).find((name) => this.options.classes.includes(name));
          return found ?? null;
        },
        renderHTML: (attributes: { class?: string | null }) =>
          attributes.class ? { class: attributes.class } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[class]",
        getAttrs: (element: HTMLElement) =>
          Array.from(element.classList).some((name) => this.options.classes.includes(name)) ? null : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

export const SiteRule = HorizontalRule.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => (element.classList.contains(SPACE_CLASS) ? SPACE_CLASS : null),
        renderHTML: (attributes: { class?: string | null }) =>
          attributes.class === SPACE_CLASS ? { class: SPACE_CLASS } : {},
      },
    };
  },
});
