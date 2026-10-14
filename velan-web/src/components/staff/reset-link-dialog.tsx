"use client";

import { Link2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetMessage, staffLogin, visibleEmail, type StaffMember } from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { ShareLinkPanel } from "./share-link";
import { useCreateResetLink } from "./use-staff";

/** Head-issued, single-use password reset link (24 h) to share by WhatsApp, email or copy. */
export function ResetLinkDialog({
  member,
  open,
  onOpenChange,
}: {
  member: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Unmounted on close: the link (a credential) isn't kept around. */}
        {member && <ResetLinkBody key={member.id} member={member} />}
      </DialogContent>
    </Dialog>
  );
}

function ResetLinkBody({ member }: { member: StaffMember }) {
  const create = useCreateResetLink();
  const name = member.displayName?.trim() || null;
  const login = staffLogin(member);
  const email = member.role === "manager" ? visibleEmail(member.email) : null;
  const link = create.data;

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Password reset link{name ? ` for ${name}` : ""}</DialogTitle>
        <DialogDescription>
          A one-time link, valid for 24 hours, where {name ?? "they"} can choose a new password. Their current password
          keeps working until the link is used.
        </DialogDescription>
      </DialogHeader>

      {create.isError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>
            {isApiError(create.error) ? create.error.message : "Something went wrong. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {link ? (
        <ShareLinkPanel
          label="Reset link"
          url={link.resetUrl}
          expiresAt={link.expiresAt}
          message={resetMessage({ name, login: login?.value, url: link.resetUrl, expiresAt: link.expiresAt })}
          emailTo={email}
          emailSubject="Set a new Velan Spaces password"
          note={
            member.role === "worker"
              ? "Workers don't have an email address — send it on WhatsApp or paste it into a message to them only."
              : "Send it only to them. Anyone with the link can set the password until it's used."
          }
        />
      ) : null}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" size="lg" />}>{link ? "Done" : "Cancel"}</DialogClose>
        {!link && (
          <Button type="button" size="lg" disabled={create.isPending} onClick={() => create.mutate(member.id)}>
            {create.isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
            ) : (
              <Link2 data-icon="inline-start" aria-hidden />
            )}
            {create.isPending ? "Creating…" : "Create link"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
