"use client";

import { forwardRef, useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { planningTime, type Planning } from "@/lib/planning-shared";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Field } from "@/types/field";
import { describePlanning } from "./describe";

const pad = (n: number) => String(n).padStart(2, "0");

/** Saved value -> what <input type="datetime-local"> shows (the client's own clock). */
const toInput = (value: unknown, end: boolean) => {
  const date = planningTime(value, end);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** "2026-12-05T09:00" from the input -> "2026-12-05T09:00+01:00", so the website knows the exact moment. */
const fromInput = (text: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${text}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
};

const asPlanning = (value: unknown): Planning =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Planning : {};

const EditComponent = forwardRef((props: {
  value?: unknown;
  onChange: (value: Planning | "") => void;
  field: Field;
}, ref: React.Ref<HTMLDivElement>) => {
  const { value, onChange, field } = props;
  const readonly = Boolean(field.readonly);
  const planning = asPlanning(value);

  // The sentence under the dates follows the clock ("Staat online tot ...").
  // Dates depend on the client's clock and time zone: only show them in the browser.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const set = (key: "vanaf" | "tot", text: string) => {
    const next: Planning = { ...planning, [key]: fromInput(text) };
    if (!next.vanaf) delete next.vanaf;
    if (!next.tot) delete next.tot;
    onChange(Object.keys(next).length ? next : "");
  };

  if (!now) return <div ref={ref} className="h-32 animate-pulse rounded-md bg-muted" />;

  const summary = describePlanning(planning, now);

  const row = (key: "vanaf" | "tot", label: string) => {
    const shown = toInput(planning[key], key === "tot");
    return (
      <label className="flex flex-wrap items-center gap-2">
        <span className="w-28 shrink-0 text-sm">{label}</span>
        <Input
          type="datetime-local"
          value={shown}
          onChange={(event) => set(key, event.target.value)}
          readOnly={readonly}
          aria-label={label}
          className={cn("w-60 max-w-full text-base", readonly && "focus-visible:border-input focus-visible:ring-0")}
        />
        {!readonly && shown && (
          <Button type="button" variant="ghost" size="icon" onClick={() => set(key, "")} aria-label={t("Clear {label}", { label })} title={t("Clear")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </label>
    );
  };

  return (
    <div ref={ref} className="space-y-2">
      {row("vanaf", t("Online from"))}
      {row("tot", t("Offline after"))}
      <div
        className={cn(
          "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
          summary.state === "invalid" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
        aria-live="polite"
      >
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {summary.text}
          {summary.state === "always" && !readonly && ` ${t("Fill in a date to put it online or offline automatically.")}`}
          {(summary.state === "waiting" || (summary.state === "online" && planning.tot)) && ` ${t("Save as usual; the website changes by itself at that time (give it a few minutes).")}`}
        </span>
      </div>
    </div>
  );
});

EditComponent.displayName = "PlanningEditComponent";

export { EditComponent };
