"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { staffLogin, type StaffMember } from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { NO_AUTOFILL } from "./login-inputs";
import { useDeleteStaff } from "./use-staff";

/** What the head must type to confirm: the display name, else the login. */
export function deleteConfirmText(member: StaffMember): string {
  return member.displayName?.trim() || staffLogin(member)?.value || "delete";
}

const matches = (typed: string, expected: string) =>
  typed.trim().localeCompare(expected, "en", { sensitivity: "accent" }) === 0;

export function StaffDeleteDialog({
  member,
  open,
  onOpenChange,
}: {
  member: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        {member && <DeleteBody key={member.id} member={member} onDone={() => onOpenChange(false)} />}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteBody({ member, onDone }: { member: StaffMember; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteStaff();
  const expected = deleteConfirmText(member);
  const ok = matches(typed, expected);
  const pending = remove.isPending;

  const confirm = async () => {
    if (!ok || pending) return;
    setError(null);
    try {
      await remove.mutateAsync(member.id);
      toast.success(`${expected}'s account was deleted.`);
      onDone();
    } catch (e) {
      setError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {expected}&apos;s account?</AlertDialogTitle>
        <AlertDialogDescription>
          They lose access straight away and are removed from all their projects. Updates, photos and messages they
          posted stay on the projects, but without their name. This can&apos;t be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>

      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="delete-confirm" className="text-sm text-ink">
          Type <span className="font-semibold">{expected}</span> to confirm
        </label>
        <Input
          id="delete-confirm"
          {...NO_AUTOFILL}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={pending}
          className="h-10"
          spellCheck={false}
        />
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction type="submit" variant="destructive" disabled={!ok || pending}>
          {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          {pending ? "Deleting…" : "Delete account"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </form>
  );
}
