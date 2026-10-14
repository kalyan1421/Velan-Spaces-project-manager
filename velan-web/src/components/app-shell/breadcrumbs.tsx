"use client";

import Link from "next/link";
import { Fragment, createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type Crumb = { label: string; href?: string };

type Slot = { owner: string; items: Crumb[] } | null;
type Ctx = { slot: Slot; setSlot: (updater: (current: Slot) => Slot) => void };

const BreadcrumbContext = createContext<Ctx | null>(null);

/** Holds the topbar breadcrumb trail; pages fill it with <SetBreadcrumbs />. */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [slot, setSlotState] = useState<Slot>(null);
  return (
    <BreadcrumbContext value={{ slot, setSlot: setSlotState }}>{children}</BreadcrumbContext>
  );
}

/**
 * Render anywhere in a page (server or client) to set the topbar trail:
 * `<SetBreadcrumbs items={[{ label: "Projects", href: "/app/projects" }, { label: name }]} />`.
 * Cleans up after itself, so hidden (Activity) routes don't leave stale crumbs.
 */
export function SetBreadcrumbs({ items }: { items: Crumb[] }) {
  const ctx = useContext(BreadcrumbContext);
  const owner = useId();
  const key = JSON.stringify(items);

  useEffect(() => {
    if (!ctx) return;
    const parsed = JSON.parse(key) as Crumb[];
    ctx.setSlot(() => ({ owner, items: parsed }));
    return () => ctx.setSlot((current) => (current?.owner === owner ? null : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `items`; ctx.setSlot is stable
  }, [key, owner]);

  return null;
}

/** The trail shown in the topbar. Falls back to `fallback` when no page set one. */
export function BreadcrumbTrail({ fallback }: { fallback?: Crumb[] }) {
  const ctx = useContext(BreadcrumbContext);
  const items = ctx?.slot?.items ?? fallback ?? [];
  if (items.length === 0) return null;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <BreadcrumbItem className={last ? "min-w-0" : "hidden min-w-0 sm:inline-flex"}>
                {last || !item.href ? (
                  <BreadcrumbPage className="truncate font-medium">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} />} className="truncate">
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
