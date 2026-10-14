"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/sign-out";
import { cn } from "@/lib/utils";

export type ShellUser = {
  name: string;
  /** Email or username, whichever exists. */
  handle: string | null;
  roleLabel: string;
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function UserMenu({ user, profileHref = "/app/profile" }: { user: ShellUser; profileHref?: string | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg px-1.5 text-sm outline-none transition-colors hover:bg-muted",
          "focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
        )}
        aria-label={`Account menu for ${user.name}`}
      >
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white"
        >
          {initialsOf(user.name)}
        </span>
        <span className="hidden max-w-40 truncate font-medium text-ink md:inline">{user.name}</span>
        <ChevronDown className="hidden size-4 text-muted-foreground md:inline" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
            {user.handle && <span className="truncate text-xs font-normal">{user.handle}</span>}
            <span className="text-xs font-normal">{user.roleLabel}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {profileHref && (
          <DropdownMenuItem onClick={() => router.push(profileHref)}>
            <UserRound aria-hidden />
            Profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut();
          }}
        >
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
