"use client";

import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SitePageSelect } from "@/components/site-page-select";
import { isPageLink, normalizeLink, useSitePages } from "@/lib/site-pages";
import { t } from "@/lib/i18n";

const OTHER = "__ander";

const EditComponent = forwardRef((props: any, ref: React.Ref<HTMLInputElement>) => {
  const { field, value, onChange, name } = props;
  const pages = useSitePages();
  const current = typeof value === "string" ? value : "";
  const readonly = Boolean(field?.readonly);
  // Another address: shown when the value isn't a page, or when the client chose "another address".
  const [other, setOther] = useState(Boolean(current) && !isPageLink(current));
  const [text, setText] = useState(isPageLink(current) ? "" : current);

  useEffect(() => {
    if (isPageLink(current)) {
      setOther(false);
    } else if (current) {
      setOther(true);
      setText(current);
    }
  }, [current]);

  const showInput = other || pages.length === 0;

  return (
    <div className="space-y-2">
      {pages.length > 0 ? (
        <SitePageSelect
          pages={pages}
          value={other ? OTHER : current}
          onChange={(next) => {
            if (next === OTHER) {
              setOther(true);
              onChange(text);
              return;
            }
            setOther(false);
            onChange(next);
          }}
          disabled={readonly}
          placeholder={t("Nowhere (no link)")}
          extraOptions={[{ value: OTHER, label: t("Another web address, email address or phone number") }]}
        />
      ) : null}
      {showInput ? (
        <Input
          ref={ref}
          name={name}
          className="text-base"
          value={text}
          readOnly={readonly}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={t("Web address, email address or phone number")}
          onChange={(event) => {
            setText(event.target.value);
            onChange(event.target.value);
          }}
          onBlur={() => {
            const normalized = normalizeLink(text);
            if (normalized !== text) {
              setText(normalized);
              onChange(normalized);
            }
          }}
        />
      ) : null}
    </div>
  );
});

EditComponent.displayName = "EditComponent";

export { EditComponent };
