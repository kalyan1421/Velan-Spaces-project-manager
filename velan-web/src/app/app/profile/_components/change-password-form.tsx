"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField, PasswordField, fieldAria } from "@/components/app-shell/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { ChangePasswordBody } from "@/lib/api/types";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/links";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match." })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from your current one.",
  });

type Values = z.infer<typeof schema>;

export function ChangePasswordForm({ canChange }: { canChange: boolean }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });

  if (!canChange) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account signs in without an email address, so the password is managed by your administrator.
      </p>
    );
  }

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      await api.post<unknown>(
        "auth/change-password",
        { currentPassword: values.currentPassword, newPassword: values.newPassword } satisfies ChangePasswordBody,
        // 401 here means "wrong current password", not "signed out".
        { on401: "throw" },
      );
      reset();
      toast.success("Password updated.");
    } catch (error) {
      if (isApiError(error) && error.status === 401) setServerError("Your current password is incorrect.");
      else if (isApiError(error)) setServerError(error.message);
      else setServerError("Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-sm space-y-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FormField id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
        <PasswordField
          autoComplete="current-password"
          {...fieldAria("currentPassword", errors.currentPassword?.message)}
          {...register("currentPassword")}
        />
      </FormField>
      <FormField
        id="newPassword"
        label="New password"
        error={errors.newPassword?.message}
        hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters.`}
      >
        <PasswordField
          autoComplete="new-password"
          {...fieldAria("newPassword", errors.newPassword?.message, "hint")}
          {...register("newPassword")}
        />
      </FormField>
      <FormField id="confirm" label="Confirm new password" error={errors.confirm?.message}>
        <PasswordField autoComplete="new-password" {...fieldAria("confirm", errors.confirm?.message)} {...register("confirm")} />
      </FormField>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
