"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField, PasswordField, fieldAria } from "@/components/app-shell/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { fetchJson } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/links";

const schema = z
  .object({
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

type Values = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newPassword: "", confirm: "" } });

  if (done) {
    return (
      <div className="space-y-4 text-center" role="status">
        <CircleCheck className="mx-auto size-10 text-success" aria-hidden />
        <p className="text-sm text-muted-foreground">Your password has been updated. Sign in with your new password.</p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "h-10 w-full" })}>
          Go to sign in
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await fetchJson(`/api/auth/reset/${encodeURIComponent(token)}`, { body: { newPassword: values.newPassword } });
      setDone(true);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FormField
        id="newPassword"
        label="New password"
        error={errors.newPassword?.message}
        hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters.`}
      >
        <PasswordField
          autoComplete="new-password"
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
    </form>
  );
}
