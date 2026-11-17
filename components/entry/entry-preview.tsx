"use client";

/**
 * Live preview: shows the site's preview page next to the form and sends it the
 * current form values on every change, before anything is saved.
 *
 * Protocol (window.postMessage, see docs/live-preview.md):
 * - preview page -> editor: { type: "pagescms:ready" } once it listens, and again
 *   whenever the editor sends { type: "pagescms:hello" }.
 * - editor -> preview page: { type: "pagescms:preview", version: 1, entry, data, media }
 * - preview page -> editor: { type: "pagescms:select", field?, path?, entry?, text?, image?, link? } when
 *   something is clicked, so the editor can jump to that field (see lib/preview-select.ts).
 *   where `data` is the entry as it would be written to the file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DESKTOP_WIDTH = 1366;
const DESKTOP_HEIGHT = 768;
const DESKTOP_MAX_HEIGHT = Math.round(DESKTOP_WIDTH / 1.6);
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
import type { PreviewSelection } from "@/lib/preview-select";
import { t } from "@/lib/i18n";

export type PreviewConfig = string | { url: string; label?: string } | undefined | null;

export type PreviewMedia = {
  name?: string;
  input: string;
  output: string;
  rawBase: string;
};

export const getPreviewUrl = (preview: PreviewConfig): string | null => {
  const url = typeof preview === "string" ? preview : preview?.url;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export function EntryPreview({
  url,
  entry,
  data,
  media,
  className,
  onSelect,
}: {
  url: string;
  entry: { name: string; path?: string };
  data: Record<string, unknown> | null;
  media: PreviewMedia[];
  className?: string;
  onSelect?: (selection: PreviewSelection) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // "Computer" shows the site at a real laptop width, scaled down to fit.
  const frameAreaRef = useRef<HTMLDivElement>(null);
  const [frameArea, setFrameArea] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = frameAreaRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setFrameArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  // On a phone the preview starts as the phone itself: full width, no frame.
  // "Computer" still shows the laptop page, scaled down in true proportions.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => {
      setIsNarrow(query.matches);
      if (query.matches) setDevice("phone");
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  // A laptop-wide screen (1366 wide, 768 to 854 high), scaled down to fit,
  // never up. It grows taller with the panel, but no further than a 16:10
  // laptop: a taller "screen" gives full-screen parts of a site (a hero of
  // 100svh) empty bands that no real visitor sees.
  const desktopStyle = useMemo(() => {
    if (!frameArea.width || !frameArea.height) return { width: "100%", height: "100%" };
    if (isNarrow) {
      // A real laptop screen (1366 x 768), shrunk to the phone's width. Not
      // stretched to fill the height: a tall frame would make the site switch
      // to its phone layout, and the proportions would no longer be right.
      const scale = (frameArea.width - 16) / DESKTOP_WIDTH;
      return {
        width: `${DESKTOP_WIDTH}px`,
        height: `${DESKTOP_HEIGHT}px`,
        left: "8px",
        top: "16px",
        transform: `scale(${scale})`,
      };
    }
    const scale = Math.min(1, (frameArea.width - 32) / DESKTOP_WIDTH, (frameArea.height - 32) / DESKTOP_HEIGHT);
    return {
      width: `${DESKTOP_WIDTH}px`,
      height: `${Math.min(DESKTOP_MAX_HEIGHT, Math.max(DESKTOP_HEIGHT, (frameArea.height - 32) / scale))}px`,
      left: `${(frameArea.width - DESKTOP_WIDTH * scale) / 2}px`,
      transform: `scale(${scale})`,
    };
  }, [frameArea, isNarrow]);
  // "Phone": a real phone screen (390 x 844, an iPhone), shrunk to fit and
  // centred, like the laptop view.
  const phoneStyle = useMemo(() => {
    if (!frameArea.width || !frameArea.height) return undefined;
    const scale = Math.min(1, (frameArea.width - 56) / PHONE_WIDTH, (frameArea.height - 40) / PHONE_HEIGHT);
    return {
      width: `${PHONE_WIDTH}px`,
      height: `${PHONE_HEIGHT}px`,
      left: `${(frameArea.width - PHONE_WIDTH * scale) / 2}px`,
      top: `${Math.max(20, (frameArea.height - PHONE_HEIGHT * scale) / 2)}px`,
      transform: `scale(${scale})`,
    };
  }, [frameArea]);
  const [reloadKey, setReloadKey] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const targetOrigin = useMemo(() => new URL(url).origin, [url]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const latest = useRef({ entry, data, media });
  latest.current = { entry, data, media };

  const send = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target || !latest.current.data) return;
    target.postMessage(
      {
        type: "pagescms:preview",
        version: 1,
        entry: latest.current.entry,
        data: latest.current.data,
        media: latest.current.media,
      },
      targetOrigin,
    );
  }, [targetOrigin]);

  // The preview page says when it is ready to receive data.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== targetOrigin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "pagescms:ready") {
        setIsConnected(true);
        send();
      }
      if (event.data?.type === "pagescms:select") {
        const { field, path, entry, text, image, link } = event.data as Record<string, unknown>;
        const asText = (value: unknown, max: number) =>
          typeof value === "string" && value.trim() ? value.slice(0, max) : undefined;
        onSelectRef.current?.({
          field: asText(field, 300),
          path: asText(path, 200),
          entry: asText(entry, 200),
          text: asText(text, 2000),
          image: asText(image, 500),
          link: link === true,
        });
      }
    };
    window.addEventListener("message", onMessage);
    // The page may have loaded before this listener existed (for example when
    // the editor was rendered on the server): ask it to say "ready" again.
    iframeRef.current?.contentWindow?.postMessage({ type: "pagescms:hello" }, targetOrigin);
    return () => window.removeEventListener("message", onMessage);
  }, [send, targetOrigin]);

  // Send changes, at most every 150 ms while typing.
  useEffect(() => {
    if (!isConnected) return;
    const timer = window.setTimeout(send, 150);
    return () => window.clearTimeout(timer);
  }, [data, isConnected, send]);

  useEffect(() => setIsConnected(false), [reloadKey, url]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-muted/40", className)}>
      <div className="flex items-center gap-2 border-b bg-background px-3 py-2">
        {!isNarrow && <span className="whitespace-nowrap text-sm font-medium">{t("Live preview")}</span>}
        <span
          className={cn(
            "inline-block size-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-muted-foreground/40",
          )}
          aria-hidden
        />
        <span className="sr-only">{isConnected ? t("Connected") : t("Loading")}</span>
        {onSelect && isConnected && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {isNarrow ? t("Tap something to change it.") : t("Click something in the preview to edit it.")}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={t("Computer")}
                aria-pressed={device === "desktop"}
                onClick={() => setDevice("desktop")}
              >
                <Monitor />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("As on a computer")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={device === "phone" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={t("Phone")}
                aria-pressed={device === "phone"}
                onClick={() => setDevice("phone")}
              >
                <Smartphone />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("As on a phone")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("Reload")}
                onClick={() => setReloadKey((key) => key + 1)}
              >
                <RotateCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("Reload")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t("Open in a new tab")}>
                  <ExternalLink />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("Open in a new tab")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div ref={frameAreaRef} className="relative flex min-h-0 flex-1 justify-center overflow-hidden">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={url}
          onLoad={() => {
            // The page has run its scripts by now, so it listens. (Its own
            // "ready" message may have arrived before this component did.)
            setIsConnected(true);
            send();
          }}
          title={t("Live preview of the website")}
          className={cn(
            "border-0 bg-white",
            device === "phone"
              ? "absolute origin-top-left rounded-xl shadow-lg"
              : "absolute top-4 origin-top-left rounded-md shadow-lg",
          )}
          style={device === "desktop" ? desktopStyle : phoneStyle}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
        {isNarrow && device === "desktop" && frameArea.width > 0 && (
          <p
            className="absolute inset-x-4 text-center text-sm text-muted-foreground"
            style={{ top: `${16 + DESKTOP_HEIGHT * ((frameArea.width - 16) / DESKTOP_WIDTH) + 12}px` }}
          >
            {t("This is how visitors see it on a laptop.")}
          </p>
        )}
      </div>
    </div>
  );
}
