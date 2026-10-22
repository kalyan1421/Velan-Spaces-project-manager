"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  USERNAME_HINT,
  editStaffSchema,
  liveUsernameProblem,
  staffEditDefaults,
  staffPatch,
  type StaffEditValues,
  type StaffMember,
} from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { LoginEmailInput, NO_AUTOFILL, UsernameInput } from "./login-inputs";
import { useUpdateStaff } from "./use-staff";

export function StaffEditDialog({
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
        {member && <EditForm key={member.id} member={member} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ member, onDone }: { member: StaffMember; onDone: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const update = useUpdateStaff();
  const schema = useMemo(() => editStaffSchema(member.role), [member.role]);
  const isWorker = member.role === "worker";
  const name = member.displayName?.trim() || (isWorker ? member.username : null) || "this person";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    setFocus,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<StaffEditValues>({
    resolver: zodResolver(schema),
    defaultValues: staffEditDefaults(member),
    mode: "onTouched",
  });

  const suspended = useWatch({ control, name: "isSuspended" });
  const login = useWatch({ control, name: "login" });
  const liveLoginError = isWorker && !touchedFields.login ? liveUsernameProblem(login ?? "") : null;
  const loginError = errors.login?.message ?? liveLoginError ?? undefined;
  const busy = isSubmitting;

  const onSubmit = async (values: StaffEditValues) => {
    setServerError(null);
    const patch = staffPatch(member, values);
    if (Object.keys(patch).length === 0) {
      onDone();
      return;
    }
    try {
      await update.mutateAsync({ id: member.id, body: patch });
      toast.success(
        patch.isSuspended === true
          ? `${name} is suspended and signed out.`
          : patch.isSuspended === false
            ? `${name} can sign in again.`
            : "Changes saved.",
      );
      onDone();
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        setError("login", {
          type: "server",
          message: isWorker ? "That username is already in use. Try another." : "That email is already in use by another account.",
        });
        setFocus("login");
        return;
      }
      setServerError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Edit {isWorker ? "worker" : "manager"}</DialogTitle>
          <DialogDescription>
            {isWorker ? "Changing the username changes what they type to sign in." : "Changing the email changes what they type to sign in."}
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" aria-live="assertive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <FormField id="edit-name" label="Full name" error={errors.displayName?.message}>
          <Input
            {...NO_AUTOFILL}
            className="h-10"
            disabled={busy}
            {...fieldAria("edit-name", errors.displayName?.message)}
            {...register("displayName")}
          />
        </FormField>

        {isWorker ? (
          <FormField id="edit-login" label="Username (used to sign in)" error={loginError} hint={USERNAME_HINT}>
            <UsernameInput disabled={busy} {...fieldAria("edit-login", loginError, "hint")} {...register("login")} />
          </FormField>
        ) : (
          <FormField id="edit-login" label="Email (used to sign in)" error={errors.login?.message}>
            <LoginEmailInput disabled={busy} {...fieldAria("edit-login", errors.login?.message)} {...register("login")} />
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="edit-phone" label="Phone" error={errors.phone?.message}>
            <Input
              {...NO_AUTOFILL}
              type="tel"
              inputMode="tel"
              className="h-10"
              disabled={busy}
              {...fieldAria("edit-phone", errors.phone?.message)}
              {...register("phone")}
            />
          </FormField>
          {isWorker && (
            <FormField id="edit-trade" label="Trade" error={errors.trade?.message}>
              <Input
                {...NO_AUTOFILL}
                className="h-10"
                disabled={busy}
                {...fieldAria("edit-trade", errors.trade?.message)}
                {...register("trade")}
              />
            </FormField>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg p-3 ring-1 ring-foreground/10">
          <div className="min-w-0">
            <p id="edit-suspended-label" className="text-sm font-medium text-ink">
              Suspend access
            </p>
            <p id="edit-suspended-hint" className="text-xs text-muted-foreground">
              {suspended
                ? "Suspended: signed out and can't sign in. Saved when you press Save."
                : "Active: can sign in and use the app."}
            </p>
          </div>
          <Switch
            checked={suspended}
            disabled={busy}
            aria-labelledby="edit-suspended-label"
            aria-describedby="edit-suspended-hint"
            onCheckedChange={(checked) => {
              if (checked) setConfirmSuspend(true);
              else setValue("isSuspended", false, { shouldDirty: true });
            }}
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" size="lg" disabled={busy} />}>Cancel</DialogClose>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>

      <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be signed out and blocked from signing in until you turn this off. Their projects, posts and
              photos stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setValue("isSuspended", true, { shouldDirty: true });
                setConfirmSuspend(false);
              }}
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
