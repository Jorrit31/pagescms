"use client";

import { Eye } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { setClientView, useClientView } from "@/lib/client-view";
import { t } from "@/lib/i18n";

/** While a builder looks "as a client": a small bar to say so, with the way back. */
export function ClientViewBanner() {
  const { user } = useUser();
  const clientView = useClientView();
  if (!clientView || !hasGithubIdentity(user)) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-background px-4 py-2 text-sm shadow-lg max-sm:bottom-[calc(5rem+env(safe-area-inset-bottom))]">
      <Eye className="size-4 shrink-0" aria-hidden="true" />
      <span>{t("You see what your client sees.")}</span>
      <button
        type="button"
        className="font-medium text-primary underline underline-offset-4"
        onClick={() => setClientView(false)}
      >
        {t("Back")}
      </button>
    </div>
  );
}
