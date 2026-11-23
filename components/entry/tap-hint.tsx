"use client";

/**
 * A short note on top of the preview, when someone came from the phone start
 * screen: "Tap the text you want to change" or "Tap the photo you want to
 * replace". It goes away once they tap something, or with the cross.
 */

import { Camera, PencilLine, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { TapMode } from "@/lib/mobile-tasks";

export function TapHint({ mode, onClose }: { mode: TapMode; onClose: () => void }) {
  const Icon = mode === "foto" ? Camera : PencilLine;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-foreground py-2.5 pr-2 pl-3.5 text-background shadow-lg animate-in fade-in slide-in-from-bottom-2"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-dot)] text-black">
          <Icon className="size-5" />
        </span>
        <span className="text-[0.95rem] leading-snug">
          {mode === "foto"
            ? t("Tap the photo you want to replace.")
            : t("Tap the text you want to change and type. Then tap Save.")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
