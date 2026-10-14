"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField, PasswordField, fieldAria } from "@/components/app-shell/password-field";
import { AccountLinkProblem } from "@/components/staff/account-link-problem";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  isLinkState,
  passwordSchema,
  type LinkState,
  type ResetLinkDetails,
} from "@/lib/api/accounts";
import { fetchJson } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { AuthHeading } from "../../../_components/auth-heading";

const schema = z
  .object({ newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

type Values = z.infer<typeof schema>;
type Screen = { kind: "form" } | { kind: "problem"; state: LinkState } | { kind: "done" };

function headingFor({ displayName, login }: ResetLinkDetails): string {
  if (displayName && login) return `Set a new password for ${displayName} (${login}).`;
  if (displayName || login) return `Set a new password for ${displayName ?? login}.`;
  return "Choose a new password for your Velan Spaces account.";
}

/** Admin-issued reset link: set a new password once, then sign in. */
export function ResetPassword({ token, details }: { token: string; details: ResetLinkDetails }) {
  const [screen, setScreen] = useState<Screen>({ kind: "form" });

  if (screen.kind === "problem") return <AccountLinkProblem kind="reset" state={screen.state} />;
  if (screen.kind === "done") return <ResetDone login={details.login} />;

  return (
    <>
      <AuthHeading title="Set a new password" description={headingFor(details)} />
      <ResetForm
        token={token}
        details={details}
        onDone={() => setScreen({ kind: "done" })}
        onProblem={(state) => setScreen({ kind: "problem", state })}
      />
    </>
  );
}

function ResetDone({ login }: { login: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <CircleCheck className="size-10 text-success" aria-hidden />
      <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">Password updated</h1>
      <p className="text-sm text-muted-foreground">
        {login ? (
          <>
            Sign in as <span className="font-medium text-ink">{login}</span> with your new password.
          </>
        ) : (
          "Sign in with your new password."
        )}
      </p>
      {/* The login page has no ?id= prefill yet, so this is a plain link. */}
      <Link href="/login" className={buttonVariants({ size: "lg", className: "h-10 w-full" })}>
        Sign in
      </Link>
    </div>
  );
}

function ResetForm({
  token,
  details,
  onDone,
  onProblem,
}: {
  token: string;
  details: ResetLinkDetails;
  onDone: () => void;
  onProblem: (state: LinkState) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newPassword: "", confirm: "" } });

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await fetchJson<{ reset: true }>(`/api/auth/reset/${token}`, { body: { newPassword: values.newPassword } });
      onDone();
    } catch (e) {
      if (isApiError(e) && isLinkState(e.code) && e.code !== "error") return onProblem(e.code);
      setError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
      setFocus("newPassword");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {details.login && (
        <FormField id="login" label="Sign-in name">
          {/* Read-only, but present so password managers update the right entry. */}
          <Input value={details.login} readOnly autoComplete="username" className="h-10 bg-muted" {...fieldAria("login")} />
        </FormField>
      )}
      <FormField
        id="newPassword"
        label="New password"
        error={errors.newPassword?.message}
        hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters.`}
      >
        <PasswordField
          autoComplete="new-password"
          autoFocus
          disabled={isSubmitting}
          {...fieldAria("newPassword", errors.newPassword?.message, "hint")}
          {...register("newPassword")}
        />
      </FormField>
      <FormField id="confirm" label="Confirm new password" error={errors.confirm?.message}>
        <PasswordField
          autoComplete="new-password"
          disabled={isSubmitting}
          {...fieldAria("confirm", errors.confirm?.message)}
          {...register("confirm")}
        />
      </FormField>
      <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        {isSubmitting ? "Saving…" : "Set new password"}
      </Button>
      {details.expiresAt && (
        <p className="text-center text-xs text-muted-foreground">
          This link works once and expires on {formatDateTime(details.expiresAt)}.
        </p>
      )}
    </form>
  );
}
