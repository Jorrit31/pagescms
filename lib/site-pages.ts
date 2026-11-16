"use client";

/**
 * The pages of the website a client can link to, by name (Webstudio).
 *
 * A content entry with `linkable: true` in .pages.yml is a page (without any
 * `linkable` in the file: every collection, plus the homepage): a file entry
 * is one page (e.g. the homepage), a collection gives one page per item
 * (each news item, each car). A link to one is stored as
 *   pagina:<content name>             e.g. pagina:home
 *   pagina:<content name>/<file>      e.g. pagina:paginas/over-ons
 * and the site's render.js turns that into the real address. So a link keeps
 * working when the site changes its addresses, and the client never types one.
 */
import useSWR from "swr";
import { useConfig } from "@/contexts/config-context";

export const PAGE_LINK_PREFIX = "pagina:";

export type SitePage = {
  value: string;
  label: string;
  group: string;
};

// What a client types as a link: an address, a phone number or an email address.
export const normalizeLink = (input: string) => {
  const value = input.trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:|tel:|pagina:|#|\/)/i.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^\+?[\d\s()-]{6,}$/.test(value)) return `tel:${value.replace(/[^\d+]/g, "")}`;
  return `https://${value}`;
};

export const isPageLink = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith(PAGE_LINK_PREFIX);

const fetchPages = async ([, owner, repo, branch, contents]: [
  string,
  string,
  string,
  string,
  Array<{ name: string; label: string; type: string }>,
]): Promise<SitePage[]> => {
  const groups = await Promise.all(
    contents.map(async (content) => {
      if (content.type !== "collection") {
        return [{ value: `${PAGE_LINK_PREFIX}${content.name}`, label: content.label, group: "" }];
      }
      const params = new URLSearchParams({ valueTemplate: "{name}", labelTemplate: "{primary}" });
      try {
        const response = await fetch(
          `/api/${owner}/${repo}/${encodeURIComponent(branch)}/references/${encodeURIComponent(content.name)}?${params}`,
        );
        if (!response.ok) return [];
        const json = await response.json();
        const options: Array<{ value?: unknown; label?: unknown }> = Array.isArray(json?.data?.options)
          ? json.data.options
          : [];
        return options
          .map((option) => {
            const file = String(option.value ?? "").replace(/\.[^./]+$/, "");
            if (!file) return null;
            return {
              value: `${PAGE_LINK_PREFIX}${content.name}/${file}`,
              label: String(option.label || file),
              group: content.label,
            };
          })
          .filter((page): page is SitePage => page !== null)
          // Newest first when the files start with a date (news), otherwise by name.
          .sort((a, b) =>
            /\/\d{4}-\d{2}-\d{2}/.test(a.value) && /\/\d{4}-\d{2}-\d{2}/.test(b.value)
              ? b.value.localeCompare(a.value)
              : a.label.localeCompare(b.label, "nl"),
          );
      } catch {
        return [];
      }
    }),
  );
  return groups.flat();
};

/** All pages a link can point to, or [] when the site has none marked `linkable`. */
export function useSitePages(): SitePage[] {
  const { config } = useConfig();
  const all: any[] = Array.isArray(config?.object?.content) ? config.object.content : [];
  // Works without setup: when no entry says `linkable`, every collection is a list of
  // pages and a file entry called home/homepage/index/start is the homepage.
  const marked = all.some((content) => typeof content?.linkable === "boolean");
  const contents = all
    .filter((content: any) =>
      typeof content?.name === "string" &&
      (marked
        ? content.linkable === true
        : content.type === "collection" || /^(home|homepage|index|start)$/i.test(content.name)),
    )
    .map((content: any) => ({
      name: String(content.name),
      label: String(content.label || content.name),
      type: String(content.type),
    }));
  const key =
    config && contents.length
      ? (["site-pages", config.owner, config.repo, config.branch, contents] as const)
      : null;
  const { data } = useSWR(key, fetchPages as any, {
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });
  return (data as SitePage[] | undefined) ?? [];
}

/** The <optgroup>s for a page list: pages without a group first. */
export const groupPages = (pages: SitePage[]) => {
  const groups = new Map<string, SitePage[]>();
  for (const page of pages) {
    const list = groups.get(page.group) ?? [];
    list.push(page);
    groups.set(page.group, list);
  }
  return Array.from(groups.entries());
};
