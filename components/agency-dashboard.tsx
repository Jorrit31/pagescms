"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AtSign,
  ExternalLink,
  Globe,
  Hammer,
  History,
  Lock,
  Pencil,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { requireApiSuccess } from "@/lib/api-client";
import { describeActivity, formatActivityTime } from "@/lib/activity-shared";
import type { AgencySite, SiteCheck } from "@/lib/agency";
import { cn } from "@/lib/utils";

/**
 * Webstudio: "Klanten", the agency dashboard. All sites at a glance, with
 * the checks Jorrit would otherwise do by hand. Only Jorrit sees this page.
 */

type Level = "ok" | "warn" | "bad" | "wait";

const levelDot: Record<Level, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-400",
  bad: "bg-red-500",
  wait: "bg-muted-foreground/40 animate-pulse",
};

const levelText: Record<Level, string> = {
  ok: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  wait: "text-muted-foreground",
};

const dateTime = (value: string | null | undefined) => (value ? formatActivityTime(value) : "nog nooit");

type Row = { icon: React.ComponentType<{ className?: string }>; label: string; level: Level; text: string };

const checkRows = (check: SiteCheck | undefined): Row[] => {
  if (!check) {
    return [
      { icon: Globe, label: "Online", level: "wait", text: "Bezig met controleren..." },
      { icon: Hammer, label: "Laatste build", level: "wait", text: "" },
      { icon: Lock, label: "Domein en https", level: "wait", text: "" },
      { icon: AtSign, label: "Mail", level: "wait", text: "" },
    ];
  }
  const rows: Row[] = [];

  if (!check.siteUrl) {
    rows.push({ icon: Globe, label: "Online", level: "warn", text: "Geen webadres bekend. Vul het hieronder in." });
  } else if (check.online?.ok) {
    const slow = (check.online.ms ?? 0) > 3000;
    rows.push({ icon: Globe, label: "Online", level: slow ? "warn" : "ok", text: `Ja, antwoordt in ${check.online.ms} ms${slow ? " (traag)" : ""}` });
  } else {
    rows.push({
      icon: Globe,
      label: "Online",
      level: "bad",
      text: check.online?.status ? `Nee, de site geeft fout ${check.online.status}` : `Nee, geen antwoord${check.online?.error ? ` (${check.online.error})` : ""}`,
    });
  }

  const build = {
    success: { level: "ok" as Level, text: "Gelukt" },
    failure: { level: "bad" as Level, text: "Mislukt: de laatste wijziging staat niet online" },
    pending: { level: "wait" as Level, text: "Wordt nu gebouwd" },
    none: { level: "warn" as Level, text: "Geen melding van de hosting (Cloudflare meldt niets aan GitHub)" },
    unknown: { level: "warn" as Level, text: "Onbekend: GitHub was niet bereikbaar" },
  }[check.build];
  rows.push({ icon: Hammer, label: "Laatste build", level: build.level, text: build.text });

  if (!check.domain) {
    rows.push({ icon: Lock, label: "Domein en https", level: "warn", text: "Niet te controleren zonder webadres" });
  } else {
    const parts = [check.domain.own ? check.domain.host : `${check.domain.host} (nog geen eigen domein)`];
    let level: Level = check.domain.own ? "ok" : "warn";
    if (!check.domain.resolves) { parts.push("domein wijst nergens naartoe"); level = "bad"; }
    if (check.https?.ok) parts.push("https werkt");
    else if (check.https) { parts.push("https werkt niet"); level = "bad"; }
    if (check.https?.httpRedirects === false) { parts.push("http stuurt niet door naar https"); if (level === "ok") level = "warn"; }
    rows.push({ icon: Lock, label: "Domein en https", level, text: parts.join(", ") });
  }

  if (!check.domain?.own) {
    rows.push({ icon: AtSign, label: "Mail", level: "ok", text: "Geen eigen domein, dus niets te controleren" });
  } else if (!check.mail) {
    rows.push({ icon: AtSign, label: "Mail", level: "warn", text: "Kon de mailinstellingen niet opvragen" });
  } else {
    const missing = [
      check.mail.mx.length === 0 && "geen MX (mail komt niet aan)",
      !check.mail.spf && "geen SPF",
      !check.mail.dmarc && "geen DMARC",
    ].filter(Boolean) as string[];
    const level: Level = check.mail.mx.length === 0 ? "bad" : missing.length ? "warn" : "ok";
    const text = missing.length
      ? `${missing.join(", ")}${check.mail.mx.length ? ` · mail via ${check.mail.mx[0]}` : ""}`
      : `In orde · mail via ${check.mail.mx[0]}`;
    rows.push({ icon: AtSign, label: "Mail", level, text });
  }

  return rows;
};

const overall = (check: SiteCheck | undefined): Level => {
  const levels = checkRows(check).map((row) => row.level);
  if (levels.includes("bad")) return "bad";
  if (levels.includes("wait")) return "wait";
  if (levels.includes("warn")) return "warn";
  return "ok";
};

function SiteCard({
  site,
  check,
  onRecheck,
  onSaved,
}: {
  site: AgencySite;
  check: SiteCheck | undefined;
  onRecheck: () => void;
  onSaved: (changes: Partial<AgencySite>) => void;
}) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlValue, setUrlValue] = useState(site.siteUrl ?? check?.siteUrl ?? "");
  const [saving, setSaving] = useState(false);
  const level = overall(check);
  const siteUrl = check?.siteUrl ?? site.siteUrl;
  const cmsHref = `/${site.owner}/${site.repo}`;
  const logHref = check?.defaultBranch ? `/${site.owner}/${site.repo}/${encodeURIComponent(check.defaultBranch)}/logboek` : null;

  const save = async (changes: { siteUrl?: string | null; monthlyReport?: boolean }) => {
    setSaving(true);
    try {
      const response = await fetch("/api/agency/site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: site.owner, repo: site.repo, ...changes }),
      });
      const payload = await requireApiSuccess<any>(response, "Opslaan is niet gelukt");
      onSaved({ siteUrl: payload.data.siteUrl, monthlyReport: payload.data.monthlyReport });
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Opslaan is niet gelukt");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const lastChange = site.lastActivity
    ? `${describeActivity(site.lastActivity)}, ${dateTime(site.lastActivity.createdAt)}`
    : check?.lastCommit
      ? `${check.lastCommit.message}, ${dateTime(check.lastCommit.date)}`
      : check ? "Nog niets gewijzigd" : "";

  return (
    <li className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", levelDot[level])} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-semibold truncate">{site.repo}</h2>
            <span className="text-xs text-muted-foreground truncate">{site.owner}</span>
          </div>
          {siteUrl && !editingUrl && (
            <a href={siteUrl} target="_blank" rel="noopener" className="text-sm text-primary hover:underline inline-flex items-center gap-1 break-all">
              {siteUrl.replace(/^https?:\/\//, "")}
              <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRecheck} aria-label="Opnieuw controleren" title="Opnieuw controleren">
          <RefreshCcw className="size-4" />
        </Button>
      </div>

      {editingUrl && (
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await save({ siteUrl: urlValue.trim() || null })) {
              setEditingUrl(false);
              onRecheck();
            }
          }}
        >
          <Input value={urlValue} onChange={(event) => setUrlValue(event.target.value)} placeholder="bijv. kreativmitblumen.de" autoFocus />
          <Button type="submit" disabled={saving}>Opslaan</Button>
          <Button type="button" variant="ghost" onClick={() => setEditingUrl(false)}>Annuleren</Button>
        </form>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground flex items-center gap-1.5"><Pencil className="size-3.5" />Laatste wijziging</dt>
          <dd className="min-w-0 break-words">{lastChange || <Skeleton className="h-4 w-40" />}</dd>
        </div>
        {checkRows(check).map((row) => (
          <div key={row.label} className="flex gap-2">
            <dt className="w-32 shrink-0 text-muted-foreground flex items-center gap-1.5"><row.icon className="size-3.5" />{row.label}</dt>
            <dd className={cn("min-w-0 break-words flex items-center gap-1.5", levelText[row.level])}>
              {row.level !== "wait" && <span className={cn("size-1.5 shrink-0 rounded-full", levelDot[row.level])} aria-hidden />}
              {row.text || <Skeleton className="h-4 w-32" />}
            </dd>
          </div>
        ))}
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5" />Klanten</dt>
          <dd className="min-w-0 space-y-0.5">
            {site.clients.length === 0 && <span className="text-muted-foreground">Nog niemand uitgenodigd</span>}
            {site.clients.map((client) => (
              <div key={client.email} className="break-all">
                {client.name ? `${client.name} · ` : ""}{client.email}
                <span className="text-muted-foreground"> · laatst ingelogd {dateTime(client.lastSeen)}</span>
              </div>
            ))}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground">Bezoekers</dt>
          <dd>{check ? (check.visitors30 ?? 0).toLocaleString("nl-NL") : <Skeleton className="h-4 w-10" />} <span className="text-muted-foreground">in 30 dagen</span></dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground">Maandrapport</dt>
          <dd className="flex items-center gap-2">
            <Switch
              checked={site.monthlyReport}
              disabled={saving}
              onCheckedChange={(checked) => save({ monthlyReport: checked })}
              aria-label="Maandrapport aan of uit"
            />
            <span className="text-muted-foreground">{site.monthlyReport ? "Elke 1e van de maand naar de klant" : "Uit"}</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild size="sm"><Link href={cmsHref}>Openen</Link></Button>
        {logHref && <Button asChild size="sm" variant="outline"><Link href={logHref}><History className="size-4" />Logboek</Link></Button>}
        <Button size="sm" variant="outline" onClick={() => { setUrlValue(siteUrl ?? ""); setEditingUrl(true); }}>
          <Globe className="size-4" />Webadres
        </Button>
      </div>
      {check?.errors && check.errors.length > 0 && (
        <p className="text-xs text-muted-foreground break-words">Niet alles kon gecontroleerd worden: {check.errors.join("; ")}</p>
      )}
    </li>
  );
}

const PARALLEL = 3;

export function AgencyDashboard({ initialSites }: { initialSites: AgencySite[] }) {
  const [sites, setSites] = useState(initialSites);
  const [checks, setChecks] = useState<Record<string, SiteCheck>>({});
  const [query, setQuery] = useState("");
  const [round, setRound] = useState(0);

  const id = (site: Pick<AgencySite, "owner" | "repo">) => `${site.owner}/${site.repo}`;

  const runCheck = async (site: AgencySite) => {
    try {
      const response = await fetch(`/api/agency/check?owner=${encodeURIComponent(site.owner)}&repo=${encodeURIComponent(site.repo)}`, { cache: "no-store" });
      const payload = await requireApiSuccess<any>(response, "Controle mislukt");
      setChecks((current) => ({ ...current, [id(site)]: payload.data }));
    } catch (error: any) {
      setChecks((current) => ({
        ...current,
        [id(site)]: {
          siteUrl: site.siteUrl, siteUrlSource: null, defaultBranch: null, lastCommit: null, build: "unknown",
          online: null, https: null, domain: null, mail: null, visitors30: null,
          errors: [error?.message || "Controle mislukt"],
        },
      }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const queue = [...initialSites];
    setChecks({});
    const worker = async () => {
      while (!cancelled && queue.length) {
        const site = queue.shift()!;
        await runCheck(site);
      }
    };
    Array.from({ length: PARALLEL }).forEach(() => { void worker(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSites, round]);

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = text
      ? sites.filter((site) => [site.repo, site.owner, site.siteUrl ?? "", ...site.clients.map((client) => `${client.email} ${client.name ?? ""}`)]
        .some((value) => value.toLowerCase().includes(text)))
      : sites;
    // Problems first, so they can't be missed.
    const order: Record<Level, number> = { bad: 0, warn: 1, wait: 2, ok: 3 };
    return [...list].sort((a, b) => order[overall(checks[id(a)])] - order[overall(checks[id(b)])]);
  }, [sites, checks, query]);

  const counts = useMemo(() => {
    const result = { bad: 0, warn: 0, ok: 0, wait: 0 };
    for (const site of sites) result[overall(checks[id(site)])] += 1;
    return result;
  }, [sites, checks]);

  const visitors = Object.values(checks).reduce((sum, check) => sum + (check.visitors30 ?? 0), 0);
  const clientCount = new Set(sites.flatMap((site) => site.clients.map((client) => client.email.toLowerCase()))).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Websites</div><div className="text-2xl font-semibold tabular-nums">{sites.length}</div></div>
        <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Klanten</div><div className="text-2xl font-semibold tabular-nums">{clientCount}</div></div>
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">Aandacht nodig</div>
          <div className={cn("text-2xl font-semibold tabular-nums", counts.bad > 0 ? levelText.bad : counts.warn > 0 ? levelText.warn : "")}>
            {counts.wait > 0 && counts.bad + counts.warn === 0 ? "…" : counts.bad + counts.warn}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Bezoekers, 30 dagen</div><div className="text-2xl font-semibold tabular-nums">{visitors.toLocaleString("nl-NL")}</div></div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek een klant of website" className="pl-8" />
        </div>
        <Button variant="outline" onClick={() => setRound((value) => value + 1)}>
          <RefreshCcw className="size-4" />Alles opnieuw
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {sites.length === 0 ? "Nog geen websites. Open een website in het beheerscherm, dan staat hij hier." : "Niets gevonden."}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((site) => (
            <SiteCard
              key={id(site)}
              site={site}
              check={checks[id(site)]}
              onRecheck={() => {
                setChecks((current) => { const next = { ...current }; delete next[id(site)]; return next; });
                void runCheck(site);
              }}
              onSaved={(changes) => setSites((current) => current.map((item) => id(item) === id(site) ? { ...item, ...changes } : item))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
