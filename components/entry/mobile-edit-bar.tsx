"use client";

/**
 * The bar at the bottom of the screen on phones and tablets: switch between
 * editing and the preview, and save. It sits where the thumb is, stays put
 * while scrolling, and sits on top of the keyboard while it is open.
 */

import { useEffect, useState } from "react";
import { Check, Eye, Loader2, PencilLine, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

// On touch screens the on-screen keyboard covers the bottom of the screen.
// The bar stays visible: while the keyboard is open it sits right on top of
// it, so Edit, Preview and Save are always one tap away.
const useKeyboardOffset = () => {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = window.innerHeight - viewport.height - viewport.offsetTop;
        // Small differences are the browser's own toolbars, not a keyboard.
        setOffset(covered > 80 ? Math.round(covered) : 0);
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
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
  const keyboardOffset = useKeyboardOffset();

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
        keyboardOffset ? "" : "pb-[env(safe-area-inset-bottom)]",
      )}
      style={keyboardOffset ? { transform: `translateY(-${keyboardOffset}px)` } : undefined}
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
