"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MailOpen, Phone, Reply, Trash2, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { t, timeAgo, uiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MESSAGES_CHANGED_EVENT } from "@/lib/forms-shared";

type Field = { name: string; label: string; value: string };
type Message = {
  id: number;
  form: string;
  fields: Field[];
  email: string | null;
  page: string | null;
  mailed: boolean;
  createdAt: string;
  readAt: string | null;
};


const notifyChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
};

/** First words of the message, for the closed row. */
const preview = (message: Message) => {
  const long = message.fields.find((field) => /bericht|message|vraag|opmerking|nachricht/i.test(field.name) && field.value)
    ?? [...message.fields].sort((a, b) => b.value.length - a.value.length)[0];
  return long?.value.replace(/\s+/g, " ").slice(0, 120) ?? "";
};

const sender = (message: Message) => {
  const name = message.fields.find((field) => /naam|name/i.test(field.name) && field.value);
  return name?.value || message.email || t("Someone");
};

/** A phone number someone typed, for a "Call" button. */
const findPhone = (message: Message) => {
  for (const field of message.fields) {
    const value = field.value.trim();
    if (/^\+?[\d\s\-()./]{8,20}$/.test(value) && value.replace(/\D/g, "").length >= 8) {
      return value.replace(/[^\d+]/g, "");
    }
  }
  return null;
};

/** "2027-06-12" from a date field reads as "12 juni 2027". */
const showValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(uiLanguage === "nl" ? "nl-NL" : undefined, { day: "numeric", month: "long", year: "numeric" });
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return date.toLocaleString(uiLanguage === "nl" ? "nl-NL" : undefined, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function Messages({
  owner,
  repo,
  branch,
  formLabels,
  showMailStatus,
}: {
  owner: string;
  repo: string;
  branch: string;
  formLabels: Record<string, string>;
  showMailStatus: boolean;
}) {
  const base = `/api/${owner}/${repo}/${encodeURIComponent(branch)}/messages`;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const multipleForms = new Set((messages ?? []).map((message) => message.form)).size > 1;

  const load = useCallback(async () => {
    try {
      const response = await fetch(base, { cache: "no-store" });
      const data = await requireApiSuccess<any>(response, "Failed to load messages");
      setMessages(data.data.messages);
      setError(null);
    } catch (loadError: any) {
      setError(loadError?.message || t("Failed to load messages"));
    }
  }, [base]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const setRead = async (message: Message, read: boolean) => {
    setMessages((current) => current?.map((item) => (
      item.id === message.id ? { ...item, readAt: read ? (item.readAt ?? new Date().toISOString()) : null } : item
    )) ?? null);
    try {
      const response = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: message.id, read }),
      });
      await requireApiSuccess(response, "Failed to update message");
      notifyChanged();
    } catch (updateError: any) {
      toast.error(updateError?.message || t("Failed to update message"));
      load();
    }
  };

  const toggle = (message: Message) => {
    const opening = openId !== message.id;
    setOpenId(opening ? message.id : null);
    if (opening && !message.readAt) setRead(message, true);
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const response = await fetch(`${base}?id=${deleting.id}`, { method: "DELETE" });
      await requireApiSuccess(response, "Failed to delete message");
      setMessages((current) => current?.filter((item) => item.id !== deleting.id) ?? null);
      notifyChanged();
      toast.success(t("Message deleted"));
    } catch (deleteError: any) {
      toast.error(deleteError?.message || t("Failed to delete message"));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  if (error && !messages) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyTitle>{t("Something went wrong")}</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!messages) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => <Skeleton key={index} className="h-20 w-full rounded-lg" />)}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <Empty className="border rounded-lg">
        <EmptyHeader>
          <Mail className="h-8 w-8 text-muted-foreground mx-auto" />
          <EmptyTitle>{t("No messages yet")}</EmptyTitle>
          <EmptyDescription>
            {t("When someone fills in the form on your website, the message shows up here and you get an e-mail.")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {messages.map((message) => {
          const open = openId === message.id;
          const unread = !message.readAt;
          return (
            <li key={message.id} className={cn("rounded-lg border bg-background", unread && "border-foreground/30")}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex gap-3 items-start min-h-14"
                onClick={() => toggle(message)}
                aria-expanded={open}
              >
                <span
                  className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", unread ? "bg-blue-600" : "bg-transparent")}
                  aria-label={unread ? t("Unread") : undefined}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{sender(message)}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(new Date(message.createdAt))}</span>
                  </span>
                  {multipleForms && (
                    <span className="block text-xs text-muted-foreground">{formLabels[message.form] ?? message.form}</span>
                  )}
                  {!open && <span className="block text-sm text-muted-foreground truncate">{preview(message)}</span>}
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4 sm:pl-[2.375rem]">
                  <dl className="space-y-3">
                    {message.fields.filter((field) => field.value).map((field) => (
                      <div key={field.name}>
                        <dt className="text-xs text-muted-foreground">{field.label}</dt>
                        <dd className="whitespace-pre-wrap break-words">{showValue(field.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(message.createdAt)}
                    {message.page ? ` · ${message.page}` : ""}
                    {showMailStatus && !message.mailed ? ` · ${t("no e-mail sent")}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.email && (
                      <Button asChild size="sm">
                        <a href={`mailto:${message.email}?subject=${encodeURIComponent(t("Re: your message"))}`}>
                          <Reply className="h-4 w-4 mr-1.5" />{t("Reply")}
                        </a>
                      </Button>
                    )}
                    {findPhone(message) && (
                      <Button asChild size="sm" variant={message.email ? "outline" : "default"}>
                        <a href={`tel:${findPhone(message)}`}>
                          <Phone className="h-4 w-4 mr-1.5" />{t("Call")}
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setRead(message, false)}>
                      <MailOpen className="h-4 w-4 mr-1.5" />{t("Mark as unread")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleting(message)}>
                      <Trash2 className="h-4 w-4 mr-1.5" />{t("Delete")}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete this message?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("You can't get it back afterwards.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); remove(); }} disabled={busy}>
              {busy && <Loader className="h-4 w-4 mr-1.5 animate-spin" />}{t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
