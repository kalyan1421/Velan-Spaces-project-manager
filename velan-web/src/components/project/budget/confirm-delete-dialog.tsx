"use client";

import { Loader2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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

/** "Are you sure?" for deleting a ledger entry. Stays open (and modal) while the delete runs. */
export function ConfirmDeleteDialog({
  open,
  title,
  description,
  pending,
  onConfirm,
  onCancel,
  returnFocus,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Where focus goes when the dialog closes (the row's menu button, or a fallback). */
  returnFocus: HTMLElement | null;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialogContent finalFocus={() => (returnFocus?.isConnected ? returnFocus : true)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
