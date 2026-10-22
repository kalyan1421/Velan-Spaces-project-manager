"use client";

import { useEffect } from "react";

/**
 * Scrolls element `id` into view when the URL hash points at it. The browser's
 * own jump misses targets that stream in after navigation (Suspense), e.g. a
 * redirect or notification link to `/portal/projects/<id>#chat`.
 */
export function ScrollToHash({ id }: { id: string }) {
  useEffect(() => {
    const scroll = () => {
      if (window.location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [id]);
  return null;
}
