"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SIDEBAR_COOKIE } from "@/lib/api/cookies";
import { isNavItemActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { BreadcrumbProvider, BreadcrumbTrail } from "./breadcrumbs";
import { NotificationsBell } from "./notifications-bell";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu, type ShellUser } from "./user-menu";

function persistCollapsed(collapsed: boolean) {
  // Non-sensitive UI preference; read server-side so the first paint is right.
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Staff app chrome: navy sidebar (collapsible) on ≥768px, a Sheet below that,
 * and a topbar with the breadcrumb slot, notifications and the account menu.
 */
export function AppShell({
  user,
  nav,
  initialCollapsed,
  children,
}: {
  user: ShellUser;
  nav: NavItem[];
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/app";
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const section = nav.find((item) => isNavItemActive(item, pathname));
  const fallbackCrumbs = section ? [{ label: section.label, href: section.href }] : [];

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    persistCollapsed(next);
  };

  return (
    <BreadcrumbProvider>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside
          aria-label="Main navigation"
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
            <Link href="/app/projects" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              <BrandMark tone="light" showName={!collapsed} size={32} />
              {collapsed && <span className="sr-only">Velan Spaces home</span>}
            </Link>
          </div>
          <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
            <SidebarNav items={nav} pathname={pathname} collapsed={collapsed} />
          </nav>
          <div className="border-t border-sidebar-border p-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/80 outline-none transition-colors",
                "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                collapsed && "justify-center px-0",
              )}
            >
              {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-6">
            {/* Mobile navigation */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={<Button variant="ghost" size="icon" className="-ml-2 size-9 md:hidden" aria-label="Open navigation" />}
              >
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <div className="flex h-14 items-center border-b border-sidebar-border px-4">
                  <BrandMark tone="light" size={32} />
                </div>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">Sections of the Velan Spaces app</SheetDescription>
                <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
                  <SidebarNav items={nav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <BreadcrumbTrail fallback={fallbackCrumbs} />
            </div>

            <div className="flex items-center gap-1">
              <NotificationsBell />
              <UserMenu user={user} />
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 outline-none md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
