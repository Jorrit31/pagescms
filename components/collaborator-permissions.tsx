"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfig } from "@/contexts/config-context";
import { handleSetCollaboratorPermissions } from "@/lib/actions/collaborator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

export const parseAllowed = (value?: string | null): string[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const useContentChoices = () => {
  const { config } = useConfig();
  return useMemo(() => (
    ((config?.object as any)?.content ?? []).map((item: any) => ({
      name: item.name as string,
      label: (item.label || item.name) as string,
    }))
  ), [config]);
};

/** Ticks per part of the website (from .pages.yml): what this person may edit. */
export function CollaboratorPermissionsDialog({
  open,
  onOpenChange,
  owner,
  repo,
  collaborator,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  repo: string;
  collaborator: { id: number; email: string; permissions?: string | null } | null;
  onSaved: (id: number, permissions: string | null) => void;
}) {
  const choices = useContentChoices();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!collaborator) return;
    const allowed = parseAllowed(collaborator.permissions);
    setSelected(new Set(allowed ?? choices.map((choice: { name: string }) => choice.name)));
  }, [collaborator, choices]);

  const save = async () => {
    if (!collaborator) return;
    setIsSaving(true);
    const everything = choices.every((choice: { name: string }) => selected.has(choice.name));
    const names = everything ? null : Array.from(selected);
    const result = await handleSetCollaboratorPermissions(collaborator.id, owner, repo, names);
    setIsSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result?.message ?? t("Saved."));
    onSaved(collaborator.id, names ? JSON.stringify(names) : null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("What may {email} edit?", { email: collaborator?.email ?? "" })}</DialogTitle>
          <DialogDescription>
            {t("Only the ticked parts show up for this person. Photos stay available.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {choices.map((choice: { name: string; label: string }) => (
            <label key={choice.name} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={selected.has(choice.name)}
                onCheckedChange={(checked) => {
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (checked) next.add(choice.name);
                    else next.delete(choice.name);
                    return next;
                  });
                }}
              />
              {choice.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
          <Button onClick={save} disabled={isSaving}>{t("Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
