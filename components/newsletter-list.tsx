"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Download, Loader, Newspaper, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { requireApiSuccess } from "@/lib/api-client";
import { t, uiLanguage } from "@/lib/i18n";

type Subscriber = { id: number; email: string; name: string; createdAt: string };

const formatDay = (value: string) => new Date(value).toLocaleDateString(
  uiLanguage === "nl" ? "nl-NL" : undefined,
  { day: "numeric", month: "long", year: "numeric" },
);

/** A cell for the CSV file; also stops spreadsheet formulas (=, +, -, @). */
const cell = (value: string) => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\n,]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
};

/**
 * Berichten page: the people who signed up for the newsletter on the website
 * (block "Nieuwsbrief"). Shows nothing until the first sign-up.
 */
export function NewsletterList({ owner, repo, branch }: { owner: string; repo: string; branch: string }) {
  const base = `/api/${owner}/${repo}/${encodeURIComponent(branch)}/messages`;
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Subscriber | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${base}?newsletter=1`, { cache: "no-store" });
      const data = await requireApiSuccess<any>(response, "Failed to load messages");
      setSubscribers(data.data.subscribers ?? []);
    } catch {
      setSubscribers([]);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  if (!subscribers || subscribers.length === 0) return null;

  const download = () => {
    const lines = [
      ["E-mail", "Naam", t("Signed up on")].join(","),
      ...subscribers.map((item) => [cell(item.email), cell(item.name), cell(new Date(item.createdAt).toISOString().slice(0, 10))].join(",")),
    ];
    const blob = new Blob([`﻿${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nieuwsbrief-${repo}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subscribers.map((item) => item.email).join("\n"));
      toast.success(t("All addresses copied"));
    } catch {
      toast.error(t("Copying didn't work. Use Download list instead."));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch(`${base}?id=${deleting.id}`, { method: "DELETE" });
      await requireApiSuccess(response, "Failed to delete message");
      setSubscribers((current) => current?.filter((item) => item.id !== deleting.id) ?? null);
      toast.success(t("Address removed from the list"));
    } catch (error: any) {
      toast.error(error?.message || t("Failed to delete message"));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const count = subscribers.length;

  return (
    <section className="mb-6 rounded-lg border bg-background">
      <div className="px-4 py-3 flex gap-3 items-start">
        <Newspaper className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">{t("Newsletter")}</h2>
          <p className="text-sm text-muted-foreground">
            {count === 1 ? t("1 person signed up on your website.") : t("{count} people signed up on your website.", { count })}
            {" "}{t("Put the list in your newsletter program, for example MailerLite or Brevo.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={download}>
              <Download className="h-4 w-4 mr-1.5" />{t("Download list")}
            </Button>
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="h-4 w-4 mr-1.5" />{t("Copy addresses")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}>
              <ChevronDown className={`h-4 w-4 mr-1.5 transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? t("Hide names") : t("Show names")}
            </Button>
          </div>
        </div>
      </div>
      {open && (
        <ul className="border-t divide-y">
          {subscribers.map((item) => (
            <li key={item.id} className="px-4 py-2 flex items-center gap-3 min-h-12">
              <span className="flex-1 min-w-0">
                <span className="block truncate">{item.email}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {item.name ? `${item.name} · ` : ""}{formatDay(item.createdAt)}
                </span>
              </span>
              <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setDeleting(item)} aria-label={t("Remove from the list")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(value) => { if (!value) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Remove {email} from the list?", { email: deleting?.email ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("Do this when someone asks to stop getting the newsletter.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); remove(); }} disabled={busy}>
              {busy && <Loader className="h-4 w-4 mr-1.5 animate-spin" />}{t("Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
