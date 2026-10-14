"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import type { ProjectTab } from "@/lib/projects";
import { cn } from "@/lib/utils";

/** Horizontal, scrollable tab bar for a project. Also owns the topbar breadcrumb trail. */
export function ProjectTabs({ tabs, projectName }: { tabs: ProjectTab[]; projectName: string }) {
  const pathname = usePathname() ?? "";
  const active =
    [...tabs].sort((a, b) => b.href.length - a.href.length).find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`)) ??
    tabs[0];
  const overview = tabs[0];

  return (
    <>
      <SetBreadcrumbs
        items={[
          { label: "Projects", href: "/app/projects" },
          ...(active && active.key !== "overview"
            ? [{ label: projectName, href: overview.href }, { label: active.label }]
            : [{ label: projectName }]),
        ]}
      />
      <nav aria-label="Project sections" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1 border-b">
          {tabs.map((tab) => {
            const isActive = tab.key === active?.key;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-10 items-center rounded-t-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive ? "text-ink" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  {tab.label}
                  {isActive && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
