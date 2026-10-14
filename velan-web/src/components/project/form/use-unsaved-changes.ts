"use client";

import { useEffect } from "react";

/**
 * Warn before the tab is closed or reloaded while there are unsaved edits.
 * In-app navigation keeps the page alive (Cache Components preserves it with
 * <Activity>), so drafts survive switching tabs inside the app.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a returnValue to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
