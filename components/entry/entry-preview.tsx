"use client";

/**
 * Live preview: shows the site's preview page next to the form and sends it the
 * current form values on every change, before anything is saved.
 *
 * Protocol (window.postMessage, see docs/live-preview.md):
 * - preview page -> editor: { type: "pagescms:ready" } once it listens, and again
 *   whenever the editor sends { type: "pagescms:hello" }.
 * - editor -> preview page: { type: "pagescms:preview", version: 1, entry, data, media }
 *   where `data` is the entry as it would be written to the file.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
}: {
  url: string;
  entry: { name: string; path?: string };
  data: Record<string, unknown> | null;
  media: PreviewMedia[];
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const targetOrigin = useMemo(() => new URL(url).origin, [url]);

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
        <span className="text-sm font-medium">{t("Live preview")}</span>
        <span
          className={cn(
            "inline-block size-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-muted-foreground/40",
          )}
          aria-hidden
        />
        <span className="sr-only">{isConnected ? t("Connected") : t("Loading")}</span>
        <div className="ml-auto flex items-center gap-1">
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
      <div className="flex min-h-0 flex-1 justify-center overflow-auto">
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
            "h-full border-0 bg-white transition-[width] duration-200",
            device === "phone" ? "my-4 w-[390px] rounded-xl shadow-lg" : "w-full",
          )}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}
