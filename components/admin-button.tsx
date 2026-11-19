"use client";

import Link from "next/link";
import { Settings, Users } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { Button } from "@/components/ui/button";

export function AdminButton() {
  const { user } = useUser();

  if (!user?.isAdmin) return null;

  return (
    <>
      {/* Webstudio: all clients and their websites. */}
      <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
        <Link href="/klanten" aria-label="Klanten" title="Klanten">
          <Users className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
        <Link href="/admin" aria-label="Admin panel">
          <Settings className="size-4" />
        </Link>
      </Button>
    </>
  );
}
