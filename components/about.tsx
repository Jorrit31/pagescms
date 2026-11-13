"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import packageJson from "../package.json";
import { BrandMark } from "@/components/brand-mark";
import { useUser } from "@/contexts/user-context";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { brand } from "@/lib/brand";
import { t } from "@/lib/i18n";

const releaseRef = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
const inferredTagVersion =
  releaseRef && /^v\d+\.\d+\.\d+/.test(releaseRef) ? releaseRef : undefined;
const version =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  inferredTagVersion ??
  packageJson.version;
const UPDATE_DOCS_URL = "https://pagescms.org/docs";

export function About() {
  const { user } = useUser();
  const isBuilder = hasGithubIdentity(user);
  const [open, setOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isBuilder) return;

    let cancelled = false;

    const loadLatestVersion = async () => {
      try {
        const response = await fetch("/api/app/version");
        if (!response.ok) return;

        const data = (await response.json()) as { latest?: string | null };
        if (!cancelled) {
          setLatestVersion(
            typeof data.latest === "string" ? data.latest : null,
          );
        }
      } catch {
        if (!cancelled) setLatestVersion(null);
      }
    };

    loadLatestVersion();

    return () => {
      cancelled = true;
    };
  }, [open, isBuilder]);

  const updateAvailable = useMemo(() => {
    if (!latestVersion) return false;
    return compareSemver(version, latestVersion) < 0;
  }, [latestVersion]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon-sm" variant="ghost">
                <BrandMark className="size-6" />
                <span className="sr-only">{t("About {name}", { name: brand.name })}</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("About {name}", { name: brand.name })}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="w-[20rem] max-w-[calc(100vw-2rem)]">
        <DialogHeader className="items-center gap-3 text-center">
          <BrandMark className="size-15" />
          <DialogTitle className="text-base font-semibold">
            {brand.name}
          </DialogTitle>
          <DialogDescription>
            {isBuilder
              ? "Based on Pages CMS, open source CMS for static sites."
              : t("Questions about your website? Contact {name}.", { name: brand.name })}
          </DialogDescription>
        </DialogHeader>

        {isBuilder && (
        <div className="rounded-lg border">
          <Row
            label="Version"
            value={
              <div className="flex items-center gap-2">
                <span className="text-sm">{version}</span>
                {updateAvailable ? (
                  <a
                    href={UPDATE_DOCS_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex"
                  >
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 font-medium text-primary"
                    >
                      Update to {latestVersion}
                      <ArrowUpRight className="ml-1 size-3" />
                    </Badge>
                  </a>
                ) : null}
              </div>
            }
          />
          <Row
            label="Website"
            value={
              <ExternalLink href="https://pagescms.org">
                pagescms.org
              </ExternalLink>
            }
          />
          <Row
            label="Docs"
            value={
              <ExternalLink href="https://pagescms.org/docs">
                pagescms.org/docs
              </ExternalLink>
            }
          />
          <Row
            label="GitHub"
            value={
              <ExternalLink href="https://github.com/pagescms/pagescms">
                pagescms/pagescms
              </ExternalLink>
            }
          />
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (!av || !bv) return 0;

  for (let i = 0; i < 3; i++) {
    if (av[i] > bv[i]) return 1;
    if (av[i] < bv[i]) return -1;
  }
  return 0;
}

function parseSemver(versionString: string): [number, number, number] | null {
  const normalized = versionString.trim().replace(/^v/i, "");
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  );
}
