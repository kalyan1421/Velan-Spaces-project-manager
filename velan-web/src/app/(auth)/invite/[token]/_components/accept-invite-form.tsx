"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField, PasswordField, fieldAria } from "@/components/app-shell/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/links";

const schema = z
  .object({
    displayName: z.string().trim().min(1, "Enter your name.").max(120, "That name is too long."),
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

type Values = z.infer<typeof schema>;
type AcceptResult = { redirectTo: string; accountExists?: boolean };

export function AcceptInviteForm({ token, email, displayName }: { token: string; email: string | null; displayName: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: displayName ?? "", password: "", confirm: "" },
  });

  if (accountExists) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          You already have a Velan Spaces account{email ? ` (${email})` : ""}. Sign in with your existing password to see
          this project.
        </p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "h-10 w-full" })}>
          Sign in
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      const result = await fetchJson<AcceptResult>(`/api/auth/invite/${encodeURIComponent(token)}`, {
        body: { displayName: values.displayName, password: values.password },
      });
      if (result.accountExists) {
        setAccountExists(true);
        return;
      }
      setRedirecting(true);
      window.location.assign(result.redirectTo);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
    }
  };

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {email && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Email</p>
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-ink">{email}</p>
        </div>
      )}
      <FormField id="displayName" label="Your name" error={errors.displayName?.message}>
        <Input
          autoComplete="name"
          className="h-10"
          disabled={busy}
          {...fieldAria("displayName", errors.displayName?.message)}
          {...register("displayName")}
        />
      </FormField>
      <FormField
        id="password"
        label="Create a password"
        error={errors.password?.message}
        hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters.`}
      >
        <PasswordField
          autoComplete="new-password"
          disabled={busy}
          {...fieldAria("password", errors.password?.message, "hint")}
          {...register("password")}
        />
      </FormField>
      <FormField id="confirm" label="Confirm password" error={errors.confirm?.message}>
        <PasswordField
          autoComplete="new-password"
          disabled={busy}
          {...fieldAria("confirm", errors.confirm?.message)}
          {...register("confirm")}
        />
      </FormField>
      <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {redirecting ? "Opening your project…" : isSubmitting ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
