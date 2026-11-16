"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useUser } from "@/contexts/user-context";
import { signOut } from "@/lib/auth-client";
import { getInitialsFromName } from "@/lib/utils/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Settings, LogOut } from "lucide-react";
import { t } from "@/lib/i18n";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { setClientView, useClientView } from "@/lib/client-view";

export function User({
  className,
  onClick,
  align = "end",
}: {
  className?: string;
  onClick?: () => void;
  align?: "start" | "center" | "end";
}) {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const clientView = useClientView();
  const isBuilder = hasGithubIdentity(user);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(className, "rounded-full")}
        >
          <Avatar className="size-6">
            {/* The builder's own GitHub picture; everyone else (and "as a client") sees initials. */}
            {isBuilder && !clientView && user?.githubUsername ? (
              <AvatarImage src={`https://github.com/${user.githubUsername}.png`} alt={user?.name || user.email} />
            ) : null}
            <AvatarFallback>
              {user.name ? getInitialsFromName(user.name) : (user.email || "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent forceMount align={align} className="max-w-[12.5rem]">
        <DropdownMenuLabel>
          <div className="text-sm font-medium truncate">
            {user.name || (isBuilder && !clientView ? user.githubUsername : null) || user.email}
          </div>
          <div className="text-xs font-normal text-muted-foreground truncate">
            {user.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="w-40 text-xs text-muted-foreground font-medium">
          {t("Theme")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" onClick={onClick}>
            {t("Light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" onClick={onClick}>
            {t("Dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" onClick={onClick}>
            {t("System")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">{t("Settings")}</Link>
        </DropdownMenuItem>
        {isBuilder ? (
          <DropdownMenuItem
            onClick={() => {
              setClientView(!clientView);
              if (onClick) onClick();
            }}
          >
            {clientView ? t("Back to the builder view") : t("View as a client")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            if (onClick) onClick();
            await signOut();
            window.location.assign("/sign-in");
          }}
        >
          {t("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
