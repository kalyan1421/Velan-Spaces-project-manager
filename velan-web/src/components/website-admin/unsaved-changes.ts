"use client";

import { useCallback, useEffect, useRef } from "react";

export const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

export type LinkClick = {
  href: string;
  target: string;
  download: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

/**
 * True when a click on a link would navigate this tab to another in-app page
 * (Next `<Link>` or a plain same-origin `<a>`). New-tab/download clicks, hash
 * links and other origins are left alone (`beforeunload` covers full unloads).
 */
export function shouldConfirmLinkNavigation(click: LinkClick, currentHref: string): boolean {
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (click.download || (click.target && click.target !== "_self")) return false;
  if (!click.href) return false;

  let next: URL;
  let current: URL;
  try {
    next = new URL(click.href, currentHref);
    current = new URL(currentHref);
  } catch {
    return false;
  }
  if (next.origin !== current.origin) return false;
  return next.pathname !== current.pathname || next.search !== current.search;
}

/**
 * Warns before losing unsaved edits: browser reload/close (`beforeunload`) and
 * in-app link clicks (a capture listener runs before Next's `<Link>` handler).
 * Returns `confirmLeave()` for the form's own Cancel/Back actions and
 * `allowLeave()` to call right before navigating after a successful save.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  const leavingRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    leavingRef.current = false;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || leavingRef.current) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const click: LinkClick = {
        href: anchor.href,
        target: anchor.target,
        download: anchor.hasAttribute("download"),
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
      };
      if (!shouldConfirmLinkNavigation(click, window.location.href)) return;
      if (window.confirm(UNSAVED_MESSAGE)) {
        leavingRef.current = true;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current || window.confirm(UNSAVED_MESSAGE)) {
      leavingRef.current = true;
      return true;
    }
    return false;
  }, []);

  const allowLeave = useCallback(() => {
    leavingRef.current = true;
  }, []);

  return { confirmLeave, allowLeave };
}
