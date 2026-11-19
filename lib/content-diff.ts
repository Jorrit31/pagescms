/**
 * What changed between two versions of a page, field by field, in words a
 * client understands: "De salon · Titel: Welkom → Rust en aandacht".
 *
 * Used by the "Are you sure?" check before something goes live and by the
 * history of earlier versions (where each change can be put back on its own).
 * Both sides are values in the shape of the edit form.
 */

import type { Field } from "@/types/field";
import { t } from "@/lib/i18n";

export type ContentChange = {
  /** Form path of the changed value ("blocks.2.title"); put `before` back here to undo it. */
  path: string;
  /** "De salon · Titel" */
  label: string;
  /** The values in the form, to put one back. */
  beforeValue: unknown;
  afterValue: unknown;
  /** Short text to show. Empty means "(leeg)". */
  before: string;
  after: string;
};

const MAX_TEXT = 140;

const fieldLabel = (field: Field) =>
  typeof field.label === "string" && field.label.trim() ? field.label.trim() : field.name;

const same = (a: unknown, b: unknown) => {
  if (a === b) return true;
  const empty = (value: unknown) => value == null || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty(a) && empty(b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const shorten = (text: string) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT - 1)}…` : clean;
};

const stripHtml = (html: string) =>
  html
    .replace(/<(br|\/p|\/h\d|\/li|\/blockquote)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");

const fileName = (value: string) => {
  const name = value.split("?")[0].split("/").pop() || value;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

/** The first short text in an item, to tell items apart ("Microneedling"). */
const itemTitle = (fields: Field[] | undefined, value: unknown): string | null => {
  if (!fields || !value || typeof value !== "object") return null;
  for (const field of fields) {
    if (field.hidden || field.list) continue;
    if (field.type !== "string" && field.type !== "text") continue;
    const text = (value as Record<string, unknown>)[field.name];
    if (typeof text === "string" && text.trim()) {
      const clean = text.replace(/\s+/g, " ").trim();
      return clean.length > 40 ? `${clean.slice(0, 39)}…` : clean;
    }
  }
  return null;
};

const blockOf = (field: Field, value: unknown) => {
  if (field.type !== "block" || !value || typeof value !== "object") return undefined;
  const name = (value as Record<string, unknown>)[field.blockKey || "_block"];
  return field.blocks?.find((block) => block.name === name);
};

const itemFields = (field: Field, value: unknown) =>
  field.type === "block" ? blockOf(field, value)?.fields : field.fields;

// A block is called by its kind ("De salon"), an item in a list by its first
// text ("Microneedling"), otherwise by its number ("Behandeling 2").
const itemLabel = (field: Field, value: unknown, index: number) => {
  const block = blockOf(field, value);
  if (block) return fieldLabel(block);
  return itemTitle(itemFields(field, value), value) || `${fieldLabel(field)} ${index + 1}`;
};

/** A value as a short text. */
export const describeValue = (field: Field | undefined, value: unknown): string => {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    if (!field || field.type === "object" || field.type === "block") {
      const names = value.map((item, index) => (field ? itemLabel(field, item, index) : String(index + 1)));
      return shorten(names.join(", "));
    }
    return shorten(value.map((item) => describeValue({ ...field, list: false }, item)).filter(Boolean).join(", "));
  }
  if (typeof value === "boolean") return value ? t("On") : t("Off");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (field?.type === "image" || field?.type === "file") return fileName(value);
    if (field?.type === "rich-text" || /<\/?[a-z][^>]*>/i.test(value)) return shorten(stripHtml(value));
    return shorten(value);
  }
  if (typeof value === "object") {
    if (field && (field.type === "object" || field.type === "block")) {
      return itemLabel(field, value, 0);
    }
    return shorten(JSON.stringify(value));
  }
  return shorten(String(value));
};

/** The changes from `before` to `after`, in the order of the form. */
export const diffContent = (
  fields: Field[],
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): ContentChange[] => {
  const changes: ContentChange[] = [];

  const push = (field: Field, path: string, labels: string[], a: unknown, b: unknown) => {
    changes.push({
      path,
      label: labels.join(" · "),
      beforeValue: a,
      afterValue: b,
      before: describeValue(field, a),
      after: describeValue(field, b),
    });
  };

  const visitFields = (list: Field[] | undefined, a: unknown, b: unknown, parent: string, labels: string[]) => {
    const objectA = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    const objectB = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    for (const field of list || []) {
      if (!field || field.hidden) continue;
      visitField(
        field,
        objectA[field.name],
        objectB[field.name],
        parent ? `${parent}.${field.name}` : field.name,
        field.label === false ? labels : [...labels, fieldLabel(field)],
      );
    }
  };

  const visitItem = (field: Field, a: unknown, b: unknown, path: string, labels: string[]) => {
    if (field.type === "object") return visitFields(field.fields, a, b, path, labels);
    if (field.type === "block") {
      const blockA = blockOf(field, a);
      const blockB = blockOf(field, b);
      // Another kind of block: one change for the whole block.
      if (blockA?.name !== blockB?.name) return push(field, path, labels, a, b);
      return visitFields(blockB?.fields, a, b, path, labels);
    }
    push(field, path, labels, a, b);
  };

  const visitField = (field: Field, a: unknown, b: unknown, path: string, labels: string[]) => {
    if (same(a, b)) return;
    if (field.list) {
      const listA = Array.isArray(a) ? a : [];
      const listB = Array.isArray(b) ? b : [];
      const isItemList = field.type === "object" || field.type === "block";
      // Same number of items: compare them one by one. Otherwise (added,
      // removed) the list as a whole is one change, so putting it back is safe.
      if (isItemList && listA.length === listB.length) {
        listB.forEach((item, index) => {
          visitItem(
            { ...field, list: false },
            listA[index],
            item,
            `${path}.${index}`,
            [...labels.slice(0, -1), itemLabel(field, item, index)],
          );
        });
        return;
      }
      return push(field, path, labels, a, b);
    }
    if (field.type === "object" || field.type === "block") return visitItem(field, a, b, path, labels);
    push(field, path, labels, a, b);
  };

  visitFields(fields, before, after, "", []);
  return changes;
};
