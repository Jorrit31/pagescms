/**
 * Extras for the simple text editor (rich-text field with `options.toolbar`).
 *
 * - SiteStyle: a text style from the website's own design ("Handschrift",
 *   "Opvallend", ...). Stored as <span class="...">; only the classes that the
 *   site's .pages.yml lists are kept, so a client can't add other styling.
 * - SiteRule: a dividing line (<hr>) or empty space (<hr class="ruimte">).
 * - SiteAlign: centred or right-aligned text (<p class="midden">, <p class="rechts">).
 * - SiteLink: a link, or a link shown as a button (<a class="knop">).
 * - SiteVideo: a YouTube or Vimeo video (<div class="video"><iframe></div>).
 * Photo places (img class foto-links / foto-rechts / foto-klein) live on the image in index.tsx.
 * All of it is classes, never inline styles: the site's own design decides how it looks.
 */
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import Link from "@tiptap/extension-link";
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
        consuming: false,
        getAttrs: (element: HTMLElement) =>
          Array.from(element.classList).some((name) => this.options.classes.includes(name)) ? null : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

/** A text size for some words: <span class="tekst-groot">. The same sizes as for a whole paragraph. */
export const SiteSize = Mark.create({
  name: "siteSize",

  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => TEXT_SIZES.find((name) => element.classList.contains(name)) ?? null,
        renderHTML: (attributes: { class?: string | null }) =>
          attributes.class && (TEXT_SIZES as readonly string[]).includes(attributes.class)
            ? { class: attributes.class }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[class]",
        consuming: false,
        getAttrs: (element: HTMLElement) =>
          TEXT_SIZES.some((name) => element.classList.contains(name)) ? null : false,
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

/**
 * Alignment of a paragraph or heading: <p class="midden"> or <p class="rechts">.
 * Classes instead of inline styles, so the site's design decides what it looks like.
 */
export const ALIGN_CLASSES = ["midden", "rechts"] as const;
export type AlignClass = (typeof ALIGN_CLASSES)[number];

/** Text size of a paragraph, from the site's design: <p class="tekst-groot">. No class = normal. */
export const TEXT_SIZES = ["tekst-klein", "tekst-groot", "tekst-xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
/** Space between the lines of a paragraph or heading: <p class="regels-dicht">. No class = normal. */
export const LINE_SPACINGS = ["regels-dicht", "regels-ruim"] as const;
export type LineSpacing = (typeof LINE_SPACINGS)[number];

// One attribute that is one class out of a fixed list (several can sit on one element).
const classAttribute = (key: string, names: readonly string[]) => ({
  default: null,
  parseHTML: (element: HTMLElement) => names.find((name) => element.classList.contains(name)) ?? null,
  renderHTML: (attributes: Record<string, unknown>) =>
    typeof attributes[key] === "string" && names.includes(attributes[key] as string)
      ? { class: attributes[key] as string }
      : {},
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    siteAlign: {
      setAlign: (align: AlignClass | null) => ReturnType;
      setTextSize: (size: TextSize | null) => ReturnType;
      setLineSpacing: (spacing: LineSpacing | null) => ReturnType;
    };
  }
}

export const SiteAlign = Extension.create({
  name: "siteAlign",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          size: classAttribute("size", TEXT_SIZES),
        },
      },
      {
        types: ["paragraph", "heading"],
        attributes: {
          spacing: classAttribute("spacing", LINE_SPACINGS),
          align: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              ALIGN_CLASSES.find((name) => element.classList.contains(name)) ??
              (element.style.textAlign === "center" ? "midden" : element.style.textAlign === "right" ? "rechts" : null),
            renderHTML: (attributes: { align?: string | null }) =>
              attributes.align && (ALIGN_CLASSES as readonly string[]).includes(attributes.align)
                ? { class: attributes.align }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextSize:
        (size) =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", { size }),
      setLineSpacing:
        (spacing) =>
        ({ commands }) => {
          const a = commands.updateAttributes("paragraph", { spacing });
          const b = commands.updateAttributes("heading", { spacing });
          return a || b;
        },
      setAlign:
        (align) =>
        ({ commands }) => {
          const a = commands.updateAttributes("paragraph", { align });
          const b = commands.updateAttributes("heading", { align });
          return a || b;
        },
    };
  },
});

/** Where a photo in the text goes: next to the text (left/right), small in the middle, or full width (no class). */
export const PHOTO_PLACES = ["foto-links", "foto-rechts", "foto-klein"] as const;
export type PhotoPlace = (typeof PHOTO_PLACES)[number];

/** A link shown as a button: <a class="knop">. */
export const BUTTON_CLASS = "knop";

export const SiteLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => (element.classList.contains(BUTTON_CLASS) ? BUTTON_CLASS : null),
        renderHTML: (attributes: { class?: string | null }) =>
          attributes.class === BUTTON_CLASS ? { class: BUTTON_CLASS } : {},
      },
    };
  },
});

/**
 * A YouTube or Vimeo link, made into the address of the player. Anything else: null.
 * YouTube goes through youtube-nocookie.com, so no cookies until the visitor presses play.
 */
export const videoEmbedUrl = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  let url: URL;
  try {
    const value = input.trim();
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  const id = (value: string | null | undefined) => (value && /^[\w-]{6,20}$/.test(value) ? value : null);
  let youtube: string | null = null;
  if (host === "youtu.be") youtube = id(url.pathname.split("/")[1]);
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const [, kind, value] = url.pathname.split("/");
    youtube = kind === "watch" ? id(url.searchParams.get("v")) : ["embed", "shorts", "live", "v"].includes(kind) ? id(value) : null;
  }
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube}`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const number = url.pathname.split("/").find((part) => /^\d{5,12}$/.test(part));
    if (number) return `https://player.vimeo.com/video/${number}`;
  }
  return null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    siteVideo: {
      setVideo: (src: string) => ReturnType;
    };
  }
}

/** A video (YouTube or Vimeo) in the text: <div class="video"><iframe src="..."></iframe></div>. */
export const SiteVideo = Node.create({
  name: "siteVideo",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { src: { default: null } };
  },

  parseHTML() {
    const fromIframe = (element: HTMLElement) => {
      const src = videoEmbedUrl(element.getAttribute("src"));
      return src ? { src } : false;
    };
    return [
      {
        tag: "div.video",
        getAttrs: (element: HTMLElement) => {
          const iframe = element.querySelector("iframe");
          return iframe ? fromIframe(iframe) : false;
        },
      },
      { tag: "iframe[src]", getAttrs: fromIframe },
    ];
  },

  renderHTML({ node }) {
    return [
      "div",
      { class: "video" },
      [
        "iframe",
        {
          src: node.attrs.src,
          title: "Video",
          loading: "lazy",
          allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen",
          allowfullscreen: "true",
        },
      ],
    ];
  },

  addCommands() {
    return {
      setVideo:
        (src) =>
        ({ commands }) => {
          const clean = videoEmbedUrl(src);
          return clean ? commands.insertContent({ type: this.name, attrs: { src: clean } }) : false;
        },
    };
  },
});
