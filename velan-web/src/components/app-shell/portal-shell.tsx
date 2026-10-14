"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { BreadcrumbProvider, BreadcrumbTrail } from "./breadcrumbs";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu, type ShellUser } from "./user-menu";

/**
 * Client portal chrome: logo, project-name slot (pages fill it with
 * <SetBreadcrumbs />), notifications and sign out. No budget anywhere.
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
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </BreadcrumbProvider>
  );
}
