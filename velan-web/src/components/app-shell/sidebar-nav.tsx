"use client";

import type { LucideIcon } from "lucide-react";
import { BadgeIndianRupee, Bell, FolderKanban, Globe, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isNavItemActive, pathMatches, type NavIcon, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
  projects: FolderKanban,
  sales: BadgeIndianRupee,
  staff: Users,
  website: Globe,
  notifications: Bell,
  profile: UserRound,
};

export function SidebarNav({
  items,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isNavItemActive(item, pathname);
        const link = (
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active && pathname === item.href ? "page" : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {active && (
              <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-sidebar-primary" />
            )}
            <Icon
              aria-hidden
              className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/80")}
            />
            {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
          </Link>
        );

        return (
          <li key={item.href}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
            {!collapsed && item.children && (
              <ul className="mt-0.5 mb-1 ml-[1.375rem] flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                {item.children.map((child) => {
                  const childActive = pathMatches(pathname, child.href);
                  return (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={onNavigate}
                        aria-current={childActive ? "page" : undefined}
                        className={cn(
                          "flex h-8 items-center rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                          childActive
                            ? "font-medium text-sidebar-primary"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        {child.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
