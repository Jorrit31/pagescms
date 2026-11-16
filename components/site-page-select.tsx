"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { groupPages, type SitePage } from "@/lib/site-pages";

/** A plain list of the site's pages, by name. Picking one gives its "pagina:..." link. */
export function SitePageSelect({
  pages,
  value,
  onChange,
  disabled,
  placeholder,
  extraOptions = [],
  className,
}: {
  pages: SitePage[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  extraOptions?: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const known = pages.some((page) => page.value === value) || extraOptions.some((option) => option.value === value);
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{t("Choose a page of your website")}</span>
      <select
        value={known ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 w-full appearance-none truncate rounded-md border border-input bg-background pl-2.5 pr-8 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base"
      >
        <option value="">{placeholder ?? t("Choose a page of your website")}</option>
        {groupPages(pages).map(([group, list]) =>
          group ? (
            <optgroup key={group} label={group}>
              {list.map((page) => (
                <option key={page.value} value={page.value}>
                  {page.label}
                </option>
              ))}
            </optgroup>
          ) : (
            list.map((page) => (
              <option key={page.value} value={page.value}>
                {page.label}
              </option>
            ))
          ),
        )}
        {extraOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 opacity-50"
        aria-hidden="true"
      />
    </label>
  );
}
