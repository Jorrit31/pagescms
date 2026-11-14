"use client";

import { getInitialsFromName } from "@/lib/utils/avatar";
import { useConfig } from "@/contexts/config-context";
import { useUser } from "@/contexts/user-context";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { t, timeAgo } from "@/lib/i18n";
import type { EntryHistoryItem } from "@/types/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpRight, History, RotateCcw } from "lucide-react";

const MAX_ITEMS = 10;

function HistoryItemContent({ item, isCurrent }: { item: EntryHistoryItem; isCurrent: boolean }) {
  const authorName = item.commit.author?.name || item.author?.login || t("Unknown");
  const authorDate = item.commit.author?.date ? new Date(item.commit.author.date) : null;

  return (
    <>
      <Avatar className="size-7">
        <AvatarImage src={item.author?.login ? `https://github.com/${item.author.login}.png` : undefined} alt="" />
        <AvatarFallback>{getInitialsFromName(authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate">{authorDate ? timeAgo(authorDate) : t("Unknown date")}</div>
        <div className="truncate text-xs text-muted-foreground">
          {isCurrent ? t("Current version") : authorName}
        </div>
      </div>
      {!isCurrent && <RotateCcw className="size-3.5 text-muted-foreground" />}
    </>
  );
}

/**
 * The file's earlier versions. Picking one loads it into the form (and the
 * preview); nothing changes on the website until the user clicks Save.
 */
export function EntryHistoryDropdown({
  path,
  history,
  onRestore,
  triggerVariant = "ghost",
  triggerSize = "icon",
}: {
  path: string;
  history: EntryHistoryItem[];
  onRestore?: (sha: string) => void;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
}) {
  const { config } = useConfig();
  const { user } = useUser();
  const isGithubUser = hasGithubIdentity(user);

  if (!history || history.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize} aria-label={t("Previous versions")}>
          <History />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("Pick a version to put it back.")}
        </DropdownMenuLabel>
        {history.slice(0, MAX_ITEMS).map((item, index) => (
          <DropdownMenuItem
            key={item.sha}
            disabled={index === 0}
            className="flex items-center gap-3"
            onSelect={() => {
              if (index > 0) onRestore?.(item.sha);
            }}
          >
            <HistoryItemContent item={item} isCurrent={index === 0} />
          </DropdownMenuItem>
        ))}
        {isGithubUser && (
          <>
            <DropdownMenuSeparator/>
            <DropdownMenuItem asChild>
              <a
                href={`https://github.com/${config?.owner}/${config?.repo}/commits/${encodeURIComponent(config!.branch)}/${path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center w-full"
              >
                {t("View on GitHub")}
                <ArrowUpRight className="size-3 text-muted-foreground ml-auto" />
              </a>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
