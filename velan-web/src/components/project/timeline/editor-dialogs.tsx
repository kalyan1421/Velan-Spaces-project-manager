"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Shown when the server timeline changed after this editor started (another manager or a worker). */
export function ConflictDialog({
  open,
  saving,
  onCancel,
  onReload,
  onOverwrite,
}: {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onReload: () => void;
  onOverwrite: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>The timeline changed while you were editing</AlertDialogTitle>
          <AlertDialogDescription>
            Someone else saved the timeline or reported progress on a task. You can load their version (your unsaved
            changes are discarded) or save yours over it. Saving yours keeps their task progress where you didn&apos;t
            change it, but phases or tasks they added or renamed will be replaced by your plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Keep editing</AlertDialogCancel>
          <Button variant="outline" disabled={saving} onClick={onReload}>
            Load their version
          </Button>
          <AlertDialogAction disabled={saving} onClick={onOverwrite}>
            {saving && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
            {saving ? "Saving…" : "Save my version"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DiscardDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>The timeline goes back to the last saved version.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
