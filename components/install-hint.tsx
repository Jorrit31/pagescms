"use client";

/**
 * A small card on phones: "Put Webstudio Jorrit on your home screen". On
 * Android the browser can add it in one tap; on iPhone we show where to tap.
 * Hidden once added (opened from the home screen) or dismissed.
 */

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";

const STORAGE_KEY = "install-hint-dismissed";

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const wasDismissed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export function InstallHint() {
  const [mode, setMode] = useState<"ios" | "android" | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;
    if (!window.matchMedia("(pointer: coarse) and (max-width: 1023px)").matches) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIos) {
      setMode("ios");
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private mode: it just shows again next time.
    }
    setMode(null);
  };

  const [before, after] = t("Tap {share} and then \"Add to Home Screen\".").split("{share}");

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border bg-muted/50 p-2.5 pr-1">
      <img src="/images/app-icon-192.png" alt="" className="size-10 shrink-0 rounded-[9px]" />
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <p className="font-medium">{t("Put {name} on your home screen", { name: brand.name })}</p>
        <p className="text-muted-foreground">
          {mode === "ios"
            ? <>{before}<Share className="mx-0.5 inline size-4 -translate-y-0.5" aria-label="Deel" />{after}</>
            : t("Then it opens like an app, with one tap.")}
        </p>
        {mode === "android" && promptEvent && (
          <Button
            size="sm"
            className="mt-2 h-10 px-4"
            onClick={async () => {
              await promptEvent.prompt();
              dismiss();
            }}
          >
            {t("Add")}
          </Button>
        )}
      </div>
      <Button variant="ghost" size="icon" className="-my-1 shrink-0" onClick={dismiss} aria-label={t("Not now")}>
        <X />
      </Button>
    </div>
  );
}
