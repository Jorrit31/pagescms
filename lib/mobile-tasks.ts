/**
 * Webstudio: the handful of things a client really does on a phone.
 *
 * On a phone the start screen shows these as big buttons; everything else
 * sits under "Everything else". A website builder can steer this per part
 * of the site in .pages.yml with `mobile: true`, `mobile: "Own title"` or
 * `mobile: false`. Without it:
 *   - the first page with a preview gives "Change a text or price" and
 *     "Replace a photo" (both open that preview, ready to tap);
 *   - each list (news, offers, workshops...) gets "Post something new",
 *     except a list of whole pages: making pages is computer work.
 */

export type MobileTask =
  | { kind: "tap"; mode: "tekst" | "foto"; href: string; label: string }
  | { kind: "new"; href: string; label: string; title?: string }
  | { kind: "open"; href: string; label: string; title?: string; isCollection: boolean };

/** Query parameter that opens the preview on a phone with a tap hint. */
export const TAP_PARAM = "tik";
export type TapMode = "tekst" | "foto";

const flatten = (items: any[]): any[] =>
  items.flatMap((item) => (item?.type === "group" ? flatten(item.items ?? []) : [item]));

const looksLikePages = (item: any) =>
  /pagin|page/i.test(`${item.name ?? ""} ${item.label ?? ""} ${item.path ?? ""}`);

export const getMobileTasks = (object: any, base: string): MobileTask[] => {
  const content = flatten(object?.content ?? []).filter((item) => item && item.name);
  const hrefOf = (item: any) => `${base}/${item.type}/${encodeURIComponent(item.name)}`;
  const titleOf = (item: any) => (typeof item.mobile === "string" ? item.mobile : undefined);
  const tasks: MobileTask[] = [];

  // The page where most texts and photos live: the first one with a preview.
  const main =
    content.find((item) => item.type === "file" && item.preview && item.mobile !== false && item.mobile !== undefined) ||
    content.find((item) => item.type === "file" && item.preview && item.mobile !== false);
  if (main) {
    const href = hrefOf(main);
    const label = main.label || main.name;
    tasks.push({ kind: "tap", mode: "tekst", href: `${href}?${TAP_PARAM}=tekst`, label });
    tasks.push({ kind: "tap", mode: "foto", href: `${href}?${TAP_PARAM}=foto`, label });
  }

  for (const item of content) {
    if (item === main || item.mobile === false) continue;
    const label = item.label || item.name;
    if (item.type === "collection") {
      if (item.mobile === undefined && looksLikePages(item)) continue;
      tasks.push({ kind: "new", href: `${hrefOf(item)}/new`, label, title: titleOf(item) });
    } else if (item.mobile) {
      tasks.push({ kind: "open", href: hrefOf(item), label, title: titleOf(item), isCollection: false });
    }
  }
  return tasks;
};
