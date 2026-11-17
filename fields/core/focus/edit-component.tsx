"use client";

import { forwardRef, useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Crosshair, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/contexts/config-context";
import { useRepo } from "@/contexts/repo-context";
import { getRawUrl } from "@/lib/github-image";
import { t } from "@/lib/i18n";
import type { Field } from "@/types/field";

const parse = (value: unknown): [number, number] => {
  const match = /^(\d{1,3})% (\d{1,3})%$/.exec(String(value ?? ""));
  return match ? [Math.min(100, Number(match[1])), Math.min(100, Number(match[2]))] : [50, 50];
};

/** The photo field next to this one: "secties.2.focus" -> "secties.2.foto". */
const siblingName = (name: string, image: string) => {
  const parts = name.split(".");
  parts[parts.length - 1] = image;
  return parts.join(".");
};

const EditComponent = forwardRef((props: {
  name: string;
  value?: string | null;
  onChange: (value: string) => void;
  field: Field;
}, ref: React.Ref<HTMLDivElement>) => {
  const { name, value, onChange, field } = props;
  const { control } = useFormContext();
  const options = (field.options ?? {}) as { image?: string; media?: string };
  const photo = useWatch({ control, name: siblingName(name, options.image || "foto") });
  const photoPath = typeof photo === "string" && photo ? photo : Array.isArray(photo) && typeof photo[0] === "string" ? photo[0] : null;

  const { config } = useConfig();
  const { owner, repo, isPrivate } = useRepo();
  const mediaName = options.media || (config?.object as any)?.media?.[0]?.name;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoPath || !mediaName || !config?.branch) {
      setUrl(null);
      return;
    }
    getRawUrl(owner, repo, config.branch, mediaName, photoPath, isPrivate)
      .then((raw) => { if (!cancelled) setUrl(raw); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [photoPath, mediaName, owner, repo, config?.branch, isPrivate]);

  const [x, y] = parse(value);
  const readonly = Boolean(field.readonly);
  const set = (nextX: number, nextY: number) => onChange(`${Math.round(nextX)}% ${Math.round(nextY)}%`);

  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (readonly) return;
    const box = event.currentTarget.getBoundingClientRect();
    set(
      Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100)),
      Math.max(0, Math.min(100, ((event.clientY - box.top) / box.height) * 100)),
    );
  };

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (readonly) return;
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    set(Math.max(0, Math.min(100, x + move[0])), Math.max(0, Math.min(100, y + move[1])));
  };

  if (!photoPath) {
    return (
      <div ref={ref} className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
        {t("Pick a photo first, then tap the most important part of it.")}
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-2">
      <div className="text-sm text-muted-foreground">{t("Tap the most important part of the photo. That part always stays in view, also on a phone.")}</div>
      <div
        role="slider"
        tabIndex={readonly ? -1 : 0}
        aria-label={t("Focal point")}
        aria-valuetext={`${x}% ${y}%`}
        aria-valuenow={x}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={pick}
        onKeyDown={nudge}
        className="relative inline-block max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {url
          ? <img src={url} alt="" draggable={false} className="block max-h-80 w-auto max-w-full" />
          : <div className="aspect-[4/3] w-64 animate-pulse" />}
        <span
          className="pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/30 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <Crosshair className="h-4 w-4 text-white" />
        </span>
      </div>
      {url && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{t("How it is cropped on the website")}</div>
          <div className="flex max-w-sm items-end gap-2">
            <img src={url} alt="" className="aspect-[16/9] w-1/2 rounded object-cover" style={{ objectPosition: `${x}% ${y}%` }} />
            <img src={url} alt="" className="aspect-square w-1/4 rounded object-cover" style={{ objectPosition: `${x}% ${y}%` }} />
            <img src={url} alt="" className="aspect-[9/16] w-[14%] rounded object-cover" style={{ objectPosition: `${x}% ${y}%` }} />
          </div>
        </div>
      )}
      {!readonly && value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t("Back to the middle")}
        </Button>
      )}
    </div>
  );
});

EditComponent.displayName = "FocusEditComponent";

export { EditComponent };
