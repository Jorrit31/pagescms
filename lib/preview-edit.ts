/**
 * Edit in the preview: type straight into the texts of the live preview, and
 * add, move, copy or remove blocks there.
 *
 * The editor tells the preview what may be changed (buildEditMap), with every
 * preview message. The preview page only ever changes the *words* of a text the
 * site already shows, or the order of the site's own blocks: the HTML and the
 * design always come from the site itself, so nothing can break.
 *
 * Messages from the preview page (see docs/live-preview.md):
 * - { type: "pagescms:edit", field, value }            a short or long text
 * - { type: "pagescms:edit", field, leaf, texts }      words in one paragraph of a formatted text
 * - { type: "pagescms:block", action, path, to? }      add | copy | remove | move a block
 */

import type { Field } from "@/types/field";

export type EditKind = "line" | "lines" | "rich";

export type EditText = {
  kind: EditKind;
  /** The current text (line, lines). */
  value?: string;
  /** For formatted text: the text pieces of every paragraph, heading or list item. */
  leaves?: string[][];
};

export type EditItem = {
  /** What the block is called, e.g. "Prijslijst". */
  label: string;
  /** The list it is in, e.g. "secties". */
  list: string;
  index: number;
  /** May be used once: no copy button. */
  once?: boolean;
};

export type EditList = {
  count: number;
  canAdd: boolean;
  canRemove: boolean;
  /** The kinds of blocks that can be added (block lists only). */
  blocks?: { name: string; label: string }[];
  /** What one item is called, e.g. "Blok". */
  label: string;
};

export type EditMap = {
  texts: Record<string, EditText>;
  /** Photos that can be replaced by tapping them in the preview: path -> current file. */
  images: Record<string, string>;
  items: Record<string, EditItem>;
  lists: Record<string, EditList>;
};

export type PreviewEdit =
  | { field: string; value: string }
  | { field: string; leaf: number; texts: string[] };

export type PreviewBlockAction = {
  action: "add" | "copy" | "remove" | "move";
  path: string;
  /** move: the place of the block it should take, e.g. "secties.1". */
  to?: string;
};

const MAX_TEXT = 20000;

const listLimits = (field: Field) => {
  const list = typeof field.list === "object" && field.list ? field.list : {};
  return { min: typeof list.min === "number" ? list.min : 0, max: typeof list.max === "number" ? list.max : Infinity };
};

const fieldLabel = (field: Field) =>
  typeof field.label === "string" && field.label.trim() ? field.label.trim() : field.name;

// The paragraphs, headings, list items etc. of a formatted text that hold no
// other such element: the parts a visitor reads as one piece of text.
export const LEAF_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,dt,dd";

const textPieces = (element: Element): string[] => {
  const pieces: string[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) pieces.push(node.nodeValue || "");
  return pieces;
};

const leafElements = (root: ParentNode) =>
  Array.from(root.querySelectorAll(LEAF_SELECTOR)).filter((element) => !element.querySelector(LEAF_SELECTOR));

const parseHtml = (html: string) => {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html").body;
};

/** The text pieces of every paragraph of a formatted (HTML) text. */
export const richLeaves = (html: string): string[][] | undefined => {
  const body = parseHtml(html);
  if (!body) return undefined;
  return leafElements(body).map(textPieces);
};

/**
 * Put new words into one paragraph of a formatted text. Only the words change:
 * the number of pieces must stay the same, so bold, links and the rest stay
 * exactly where they were. Returns null when that is not possible.
 */
export const patchRichLeaf = (html: string, leaf: number, texts: string[]): string | null => {
  const body = parseHtml(html);
  if (!body) return null;
  const element = leafElements(body)[leaf];
  if (!element) return null;
  const nodes: Text[] = [];
  const walker = body.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  if (nodes.length !== texts.length) return null;
  nodes.forEach((node, index) => {
    node.nodeValue = texts[index];
  });
  return body.innerHTML;
};

/** What can be changed straight in the preview, for the current values. */
export const buildEditMap = (fields: Field[], values: Record<string, unknown> | null | undefined): EditMap => {
  const map: EditMap = { texts: {}, images: {}, items: {}, lists: {} };
  if (!values || typeof values !== "object") return map;

  const visitValue = (field: Field, value: unknown, path: string, readonly: boolean) => {
    if (field.type === "string" || field.type === "text") {
      if (readonly) return;
      if (value == null || typeof value === "string") {
        map.texts[path] = { kind: field.type === "string" ? "line" : "lines", value: (value as string) ?? "" };
      }
      return;
    }
    if (field.type === "image") {
      const multiple = Boolean((field.options as Record<string, unknown> | undefined)?.multiple);
      if (readonly || multiple) return;
      if (value == null || typeof value === "string") map.images[path] = (value as string) ?? "";
      return;
    }
    if (field.type === "rich-text") {
      if (readonly || field.options?.format !== "html") return;
      if (typeof value !== "string") return;
      map.texts[path] = { kind: "rich", leaves: richLeaves(value) };
      return;
    }
    if (field.type === "object") {
      if (value && typeof value === "object") visitFields(field.fields || [], value as Record<string, unknown>, path, readonly);
      return;
    }
    if (field.type === "block") {
      if (!value || typeof value !== "object") return;
      const blockKey = field.blockKey || "_block";
      const name = (value as Record<string, unknown>)[blockKey];
      const block = field.blocks?.find((item) => item.name === name);
      if (block) visitFields(block.fields || [], value as Record<string, unknown>, path, readonly);
    }
  };

  const visitField = (field: Field, value: unknown, path: string, inheritedReadonly: boolean) => {
    if (!field || field.hidden) return;
    const readonly = inheritedReadonly || Boolean(field.readonly);
    if (field.list) {
      if (!Array.isArray(value)) return;
      const { min, max } = listLimits(field);
      const isBlockList = field.type === "block" || field.type === "object";
      if (isBlockList && !readonly) {
        // A block that may be used once (a hero) is not offered again while it is there.
        const used = new Set(
          field.type === "block"
            ? value.map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>)[field.blockKey || "_block"] : undefined))
            : [],
        );
        const blocks =
          field.type === "block"
            ? (field.blocks || [])
                .filter((block) => !(block.once && used.has(block.name)))
                .map((block) => ({ name: block.name, label: fieldLabel(block) }))
            : undefined;
        map.lists[path] = {
          count: value.length,
          canAdd: value.length < max && (blocks === undefined || blocks.length > 0),
          canRemove: value.length > min,
          blocks,
          label: fieldLabel(field),
        };
        value.forEach((item, index) => {
          let label = fieldLabel(field);
          let once = false;
          if (field.type === "block" && item && typeof item === "object") {
            const name = (item as Record<string, unknown>)[field.blockKey || "_block"];
            const block = field.blocks?.find((entry) => entry.name === name);
            if (block) label = fieldLabel(block);
            once = Boolean(block?.once);
          }
          map.items[`${path}.${index}`] = once ? { label, list: path, index, once } : { label, list: path, index };
        });
      }
      value.forEach((item, index) => visitValue(field, item, `${path}.${index}`, readonly));
      return;
    }
    visitValue(field, value, path, readonly);
  };

  const visitFields = (list: Field[], object: Record<string, unknown>, parent: string, readonly: boolean) => {
    for (const field of list) {
      visitField(field, object[field.name], parent ? `${parent}.${field.name}` : field.name, readonly);
    }
  };

  visitFields(fields, values, "", false);
  return map;
};

/** Checks a message from the preview against the edit map. */
export const parsePreviewEdit = (data: unknown, map: EditMap): (PreviewEdit & { kind: EditKind }) | null => {
  if (!data || typeof data !== "object") return null;
  const { field, value, leaf, texts } = data as Record<string, unknown>;
  if (typeof field !== "string" || !Object.prototype.hasOwnProperty.call(map.texts, field)) return null;
  const target = map.texts[field];
  if (target.kind === "rich") {
    if (typeof leaf !== "number" || !Number.isInteger(leaf) || leaf < 0) return null;
    if (!Array.isArray(texts) || texts.length > 500 || !texts.every((text) => typeof text === "string")) return null;
    if (texts.join("").length > MAX_TEXT) return null;
    return { kind: "rich", field, leaf, texts: texts as string[] };
  }
  if (typeof value !== "string" || value.length > MAX_TEXT) return null;
  // A short text is one line.
  const clean = target.kind === "line" ? value.replace(/[\r\n]+/g, " ") : value.replace(/\r\n?/g, "\n");
  return { kind: target.kind, field, value: clean };
};

export const parsePreviewBlockAction = (data: unknown, map: EditMap): PreviewBlockAction | null => {
  if (!data || typeof data !== "object") return null;
  const { action, path, to } = data as Record<string, unknown>;
  if (action !== "add" && action !== "copy" && action !== "remove" && action !== "move") return null;
  if (typeof path !== "string" || !map.items[path]) return null;
  if (action === "move") {
    if (typeof to !== "string" || !map.items[to] || map.items[to].list !== map.items[path].list) return null;
    return { action, path, to };
  }
  return { action, path };
};

/** The values of a new block or item, as the editor's own "+ Add" makes them. */
export const newListItem = (
  field: Field,
  blockName: string | undefined,
  initializeState: (fields: Field[] | undefined, content?: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> | null => {
  if (field.type === "block") {
    const block = field.blocks?.find((item) => item.name === blockName);
    if (!block) return null;
    return { [field.blockKey || "_block"]: block.name, ...initializeState(block.fields, {}) };
  }
  if (field.type === "object") return initializeState(field.fields, {});
  return null;
};

/** The field definition at a data path, e.g. "secties" or "secties.3.items". */
export const findFieldAtPath = (
  fields: Field[],
  values: Record<string, unknown>,
  path: string,
): Field | null => {
  const parts = path.split(".");
  let list: Field[] = fields;
  let value: unknown = values;
  let current: Field | null = null;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (current?.list && /^\d+$/.test(part)) {
      value = Array.isArray(value) ? value[Number(part)] : undefined;
      if (current.type === "block") {
        const name = value && typeof value === "object" ? (value as Record<string, unknown>)[current.blockKey || "_block"] : undefined;
        list = current.blocks?.find((block) => block.name === name)?.fields || [];
      } else {
        list = current.fields || [];
      }
      // An item of a list is not a field of its own; keep `current` as the list.
      if (i === parts.length - 1) return current;
      current = { ...(current as Field), list: undefined };
      continue;
    }
    const field = list.find((item) => item.name === part);
    if (!field) return null;
    current = field;
    value = value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
    if (!field.list) {
      if (field.type === "block") {
        const name = value && typeof value === "object" ? (value as Record<string, unknown>)[field.blockKey || "_block"] : undefined;
        list = field.blocks?.find((block) => block.name === name)?.fields || [];
      } else {
        list = field.fields || [];
      }
    }
  }
  return current;
};
