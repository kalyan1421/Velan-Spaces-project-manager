import { notFound } from "next/navigation";

/**
 * Every portal section has its own route (`updates/`, `designs/`, `files/`,
 * `timeline/`, `support/`), which take precedence over this dynamic segment.
 * Anything else under a project is unknown: render the portal's standard
 * not-found state (`/portal/not-found.tsx`) inside the portal chrome.
 */
export default function UnknownPortalSection(): never {
  notFound();
}
