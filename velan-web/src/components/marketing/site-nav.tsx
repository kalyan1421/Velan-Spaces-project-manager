"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "cn";

import { mainNav } from "../../content/site";

/** Reads the active top-level segment. Must be rendered inside <Suspense>. */
export function ActiveSiteNav() {
  const segment = useSelectedLayoutSegment();
  return <SiteNav segment={segment} />;
}

/**
 * Desktop links + a mobile disclosure menu. `segment` is the active
 * top-level segment ("services", "portfolio", …) or null on the home page.
 */
export function SiteNav({ segment }: { segment: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isActive = (itemSegment: string | null) =>
    itemSegment === null ? segment === null || segment === "__PAGE__" : segment === itemSegment;

  return (
    <>
      {/* Desktop */}
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        <ul className="flex items-center gap-1">
          {mainNav.map((item) => {
            const active = isActive(item.segment);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.95rem] text-ink/80 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    active && "text-ink after:absolute after:inset-x-3.5 after:bottom-2 after:h-0.5 after:rounded-full after:bg-gold",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/login"
          className="ml-3 inline-flex min-h-11 items-center rounded-full border border-ink/25 px-4 text-[0.95rem] font-medium text-ink transition-colors hover:border-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Client login
        </Link>
      </nav>

      {/* Mobile */}
      <div className="md:hidden">
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>

        <nav
          id={panelId}
          aria-label="Main"
          hidden={!open}
          className="absolute inset-x-0 top-full border-b border-ink/10 bg-white shadow-[0_24px_48px_-24px_rgba(26,26,46,0.25)]"
        >
          <ul className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8">
            {mainNav.map((item) => {
              const active = isActive(item.segment);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center justify-between border-b border-ink/5 text-lg text-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      active && "font-medium text-ink",
                    )}
                  >
                    {item.label}
                    {active ? <span aria-hidden="true" className="size-2 rounded-full bg-gold" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mx-auto flex max-w-6xl gap-3 px-5 pb-5 sm:px-8">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-ink/25 font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Client login
            </Link>
            <Link
              href="/contact#enquiry"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-ink font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Get a call back
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
