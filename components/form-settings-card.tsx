"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleGetFormSettings, handleSaveFormSettings } from "@/lib/actions/site-settings";
import { getSiteForms } from "@/lib/forms-shared";
import { t } from "@/lib/i18n";

type Row = { to: string; subject: string };

/** Medewerkers page (builder only): where the messages of each form are mailed. */
export function FormSettingsCard({ owner, repo }: { owner: string; repo: string }) {
  const { config } = useConfig();
  const forms = useMemo(() => getSiteForms(config?.object), [config?.object]);
  const [rows, setRows] = useState<Record<string, Row> | null>(null);
  const [clients, setClients] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    handleGetFormSettings(owner, repo).then((result) => {
      if (cancelled) return;
      if ("error" in result && result.error) {
        setRows({});
        return;
      }
      const settings = (result as any).settings ?? {};
      setClients((result as any).clients ?? []);
      setRows(Object.fromEntries(forms.map((form) => [form.name, {
        to: (settings[form.name]?.to ?? []).join(", "),
        subject: settings[form.name]?.subject ?? "",
      }])));
    });
    return () => { cancelled = true; };
  }, [owner, repo, forms]);

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    const result = await handleSaveFormSettings(owner, repo, rows);
    setSaving(false);
    if (result?.error) toast.error(result.error);
    else toast.success(result?.message ?? t("Saved."));
  };

  const fallback = (formTo: string[]) => (
    formTo.length > 0
      ? formTo.join(", ")
      : clients.length > 0 ? clients.join(", ") : t("nobody yet: invite the client first")
  );

  return (
    <div className="rounded-md border px-3 py-3 text-sm space-y-3">
      <div className="flex items-start gap-2">
        <Mail className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">{t("Form messages")}</div>
          <div className="text-muted-foreground">{t("Where the messages from the website are mailed. They are always under Berichten too.")}</div>
        </div>
      </div>
      {rows === null ? (
        <div className="text-muted-foreground">{t("Loading...")}</div>
      ) : forms.map((form) => (
        <div key={form.name} className="space-y-2">
          {forms.length > 1 && <div className="font-medium">{form.label}</div>}
          <div className="space-y-1">
            <Label htmlFor={`form-to-${form.name}`}>{t("Mail to")}</Label>
            <Input
              id={`form-to-${form.name}`}
              type="text"
              inputMode="email"
              autoComplete="off"
              placeholder={fallback(form.to)}
              value={rows[form.name]?.to ?? ""}
              onChange={(event) => setRows({ ...rows, [form.name]: { ...rows[form.name], to: event.target.value } })}
            />
            <p className="text-xs text-muted-foreground">
              {t("Several addresses: put a comma between them. Empty = {who}.", { who: fallback(form.to) })}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`form-subject-${form.name}`}>{t("Subject of the mail")}</Label>
            <Input
              id={`form-subject-${form.name}`}
              type="text"
              placeholder={form.subject || `Nieuw bericht via je website: ${form.label}`}
              value={rows[form.name]?.subject ?? ""}
              onChange={(event) => setRows({ ...rows, [form.name]: { ...rows[form.name], subject: event.target.value } })}
            />
          </div>
        </div>
      ))}
      <Button size="sm" onClick={save} disabled={saving || rows === null}>{t("Save")}</Button>
    </div>
  );
}
