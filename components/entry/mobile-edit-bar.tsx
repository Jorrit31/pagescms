"use client";

/**
 * The bar at the bottom of the screen on phones and tablets: switch between
 * editing and the preview, and save. It sits where the thumb is, stays put
 * while scrolling, and steps aside while the keyboard is open.
 */

import { useEffect, useState } from "react";
import { Check, Eye, Loader2, PencilLine, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

const isTextField = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "file", "range", "color"].includes(element.type);
  }
  return false;
};

// On touch screens the on-screen keyboard covers the bottom of the page, and
// a fixed bar would float on top of it. Hide the bar while someone types.
const useIsTyping = () => {
  const [isTyping, setIsTyping] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const update = () => setIsTyping(isTextField(document.activeElement));
    const onFocusOut = () => window.setTimeout(update, 50);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return isTyping;
};

export function MobileEditBar({
  hasPreview,
  isPreviewOpen,
  onPreviewChange,
  canSave,
  isSaving,
}: {
  hasPreview: boolean;
  isPreviewOpen: boolean;
  onPreviewChange: (open: boolean) => void;
  canSave: boolean;
  isSaving: boolean;
}) {
  const isTyping = useIsTyping();

  // While the preview fills the screen, the form behind it should not scroll.
  useEffect(() => {
    if (!isPreviewOpen || !window.matchMedia("(max-width: 1279px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isPreviewOpen]);

  return (
    <>
    {/* Room at the end of the page, so the bar never covers the last field. */}
    <div aria-hidden className="h-20 xl:hidden" />
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 xl:hidden",
        "pb-[env(safe-area-inset-bottom)] transition-transform duration-200",
        isTyping && !isPreviewOpen ? "translate-y-full" : "translate-y-0",
      )}
    >
      <div className="mx-auto flex max-w-screen-md items-center gap-2 px-3 py-2.5">
        {hasPreview && (
          <div
            role="tablist"
            aria-label={t("View")}
            className="grid h-12 flex-1 grid-cols-2 rounded-xl bg-muted p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isPreviewOpen}
              onClick={() => onPreviewChange(false)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg text-[15px] font-medium transition-colors",
                !isPreviewOpen ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <PencilLine className="size-4" />
              {t("Edit")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isPreviewOpen}
              onClick={() => onPreviewChange(true)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg text-[15px] font-medium transition-colors",
                isPreviewOpen ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <Eye className="size-4" />
              {t("Preview")}
            </button>
          </div>
        )}
        <button
          type="submit"
          form="entry-form"
          disabled={!canSave || isSaving}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors",
            canSave || isSaving ? "text-base" : "text-sm font-medium",
            hasPreview ? "shrink-0" : "flex-1",
            canSave || isSaving
              ? "bg-primary text-primary-foreground shadow-sm active:bg-primary/90"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isSaving
            ? <Loader2 className="size-5 animate-spin" />
            : canSave
              ? <Save className="size-5" />
              : <Check className="size-5" />}
          {isSaving ? t("Saving") : canSave ? t("Save") : t("Saved")}
        </button>
      </div>
    </div>
    </>
  );
}
