"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  PORTAL_SECTIONS,
  activePortalSection,
  portalSectionHref,
} from "@/app/portal/projects/[id]/_components/portal-sections";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { BreadcrumbProvider, BreadcrumbTrail } from "./breadcrumbs";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu, type ShellUser } from "./user-menu";

/**
 * Section tabs for the project being viewed (`/portal/projects/[id]/…`).
 * Horizontally scrollable on phones; hidden outside a project.
 */
function PortalProjectNav() {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname() ?? "";
  const projectId = typeof params?.id === "string" ? params.id : null;
  if (!projectId) return null;
  const active = activePortalSection(pathname, projectId);

  return (
    <nav aria-label="Project sections" className="mx-auto w-full max-w-5xl overflow-x-auto px-4 md:px-6">
      <ul className="flex min-w-max gap-1">
        {PORTAL_SECTIONS.map((section) => {
          const isActive = section.segment === active?.segment;
          return (
            <li key={section.segment || "overview"}>
              <Link
                href={portalSectionHref(projectId, section.segment)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center rounded-t-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive ? "text-ink" : "text-muted-foreground hover:text-ink",
                )}
              >
                {section.label}
                {isActive && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Client portal chrome: logo, project-name slot (pages fill it with
 * <SetBreadcrumbs />), project section tabs, notifications and sign out.
 * No budget anywhere.
 */
export function PortalShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <BreadcrumbProvider>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 md:px-6">
            <Link href="/portal" className="shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <BrandMark size={32} showName={false} className="sm:hidden" />
              <BrandMark size={32} className="hidden sm:flex" />
              <span className="sr-only">Your projects</span>
            </Link>
            <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />
            <div className="min-w-0 flex-1">
              <BreadcrumbTrail />
            </div>
            <NotificationsBell href="/portal/notifications" />
            <UserMenu user={user} profileHref={null} />
          </div>
          <PortalProjectNav />
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </BreadcrumbProvider>
  );
}
