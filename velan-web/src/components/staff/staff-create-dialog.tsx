"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, ShieldAlert, Wand2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_HINT,
  conflictField,
  createStaffSchema,
  emptyStaffForm,
  generatePassword,
  staffLogin,
  toCreateStaffBody,
  liveUsernameProblem,
  type StaffFormValues,
  type StaffMember,
  type StaffRole,
} from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { LoginEmailInput, NO_AUTOFILL, UsernameInput } from "./login-inputs";
import { RoleToggle } from "./role-toggle";
import { CopyButton } from "./share-link";
import { useCreateStaff } from "./use-staff";

type Created = { member: StaffMember; password: string };

/** "Add staff": create a manager (email) or worker (username) with an initial password. */
export function StaffCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* Unmounted on close, so the shown-once password never outlives the dialog. */}
        <CreateFlow onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateFlow({ onClose }: { onClose: () => void }) {
  const [created, setCreated] = useState<Created | null>(null);
  if (created) return <CreatedPanel created={created} onAnother={() => setCreated(null)} onDone={onClose} />;
  return <CreateForm onCreated={setCreated} />;
}

const ROLE_COPY: Record<StaffRole, string> = {
  manager: "Managers run projects and sales. They sign in with their email.",
  worker: "Workers see their assigned projects and post updates. They sign in with a username.",
};

function CreateForm({ onCreated }: { onCreated: (created: Created) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateStaff();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    setFocus,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: emptyStaffForm("worker"),
    mode: "onTouched",
  });

  const role = useWatch({ control, name: "role" });
  const username = useWatch({ control, name: "username" });
  // Live feedback while typing a username (before the field has been left once).
  const liveUsernameError = touchedFields.username ? null : liveUsernameProblem(username ?? "");
  const usernameError = errors.username?.message ?? liveUsernameError ?? undefined;
  const busy = isSubmitting;

  const onRoleChange = (next: StaffRole) => {
    setValue("role", next);
    clearErrors(["email", "username", "trade"]);
  };

  const generate = () => {
    setValue("password", generatePassword(), { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = async (values: StaffFormValues) => {
    setServerError(null);
    try {
      const member = await create.mutateAsync(toCreateStaffBody(values));
      onCreated({ member, password: values.password });
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        const field = conflictField(values.role, e.message);
        setError(field, {
          type: "server",
          message:
            field === "username"
              ? "That username is already in use. Try another."
              : "That email is already in use by another account.",
        });
        setFocus(field);
        return;
      }
      setServerError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add staff</DialogTitle>
        <DialogDescription>{ROLE_COPY[role]}</DialogDescription>
      </DialogHeader>

      {serverError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <RoleToggle value={role} onChange={onRoleChange} disabled={busy} />

      <FormField id="staff-name" label="Full name" error={errors.displayName?.message}>
        <Input
          {...NO_AUTOFILL}
          className="h-10"
          disabled={busy}
          {...fieldAria("staff-name", errors.displayName?.message)}
          {...register("displayName")}
        />
      </FormField>

      {role === "manager" ? (
        <FormField
          id="staff-email"
          label="Email (used to sign in)"
          error={errors.email?.message}
          hint="Reset links can also be emailed here."
        >
          <LoginEmailInput
            disabled={busy}
            {...fieldAria("staff-email", errors.email?.message, "hint")}
            {...register("email")}
          />
        </FormField>
      ) : (
        <FormField id="staff-username" label="Username (used to sign in)" error={usernameError} hint={USERNAME_HINT}>
          <UsernameInput
            disabled={busy}
            placeholder="e.g. ravi.k"
            {...fieldAria("staff-username", usernameError, "hint")}
            {...register("username")}
          />
        </FormField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="staff-phone" label="Phone (optional)" error={errors.phone?.message}>
          <Input
            {...NO_AUTOFILL}
            type="tel"
            inputMode="tel"
            className="h-10"
            disabled={busy}
            {...fieldAria("staff-phone", errors.phone?.message)}
            {...register("phone")}
          />
        </FormField>
        {role === "worker" && (
          <FormField id="staff-trade" label="Trade (optional)" error={errors.trade?.message}>
            <Input
              {...NO_AUTOFILL}
              placeholder="e.g. Carpenter"
              className="h-10"
              disabled={busy}
              {...fieldAria("staff-trade", errors.trade?.message)}
              {...register("trade")}
            />
          </FormField>
        )}
      </div>

      <FormField
        id="staff-password"
        label="Initial password"
        error={errors.password?.message}
        hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters. You'll see it once after creating the account.`}
      >
        <InputGroup className="h-10">
          <InputGroupInput
            {...NO_AUTOFILL}
            type="text"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="font-mono"
            disabled={busy}
            {...fieldAria("staff-password", errors.password?.message, "hint")}
            {...register("password")}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="sm" variant="secondary" onClick={generate} disabled={busy} className="h-7 px-2">
              <Wand2 data-icon="inline-start" aria-hidden />
              Generate
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </FormField>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" size="lg" disabled={busy} />}>Cancel</DialogClose>
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          {busy ? "Creating…" : "Create account"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreatedPanel({ created, onAnother, onDone }: { created: Created; onAnother: () => void; onDone: () => void }) {
  const { member, password } = created;
  const person = member.displayName?.trim() || null;
  const login = staffLogin(member);

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Account created</DialogTitle>
        <DialogDescription>
          {person ?? "The new account"} can sign in now with these details.
        </DialogDescription>
      </DialogHeader>

      <dl className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3 ring-1 ring-foreground/10">
        {login && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{login.kind === "username" ? "Username" : "Email"}</dt>
            <dd className="font-mono text-sm break-all text-ink">{login.value}</dd>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" aria-hidden />
            Initial password
          </dt>
          <dd className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-card px-2 py-1.5 font-mono text-sm break-all text-ink ring-1 ring-foreground/10">
              {password}
            </code>
            <CopyButton value={password} what="Password" label="Copy password" />
          </dd>
        </div>
      </dl>

      <Alert>
        <ShieldAlert aria-hidden />
        <AlertTitle>This password is shown only once</AlertTitle>
        <AlertDescription>
          Share it with {person ?? "them"} privately — in person, on a call or in a direct message, never
          in a group chat. If it gets lost, send a reset link from the staff list.
        </AlertDescription>
      </Alert>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onAnother}>
          Add another
        </Button>
        <Button type="button" size="lg" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}
