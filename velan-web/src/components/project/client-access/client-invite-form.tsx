"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { LoginEmailInput, NO_AUTOFILL } from "@/components/staff/login-inputs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clientInviteSchema,
  toClientInviteBody,
  type ClientInviteBody,
  type ClientInviteResult,
  type ClientInviteValues,
} from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";

export const EMPTY_INVITE: ClientInviteValues = { email: "", displayName: "", phone: "" };

/** Email + name (+ phone) → `POST /projects/:id/client-invites`. */
export function ClientInviteForm({
  defaults,
  invite,
  onInvited,
}: {
  defaults: ClientInviteValues;
  invite: (body: ClientInviteBody) => Promise<ClientInviteResult>;
  onInvited: (result: ClientInviteResult, body: ClientInviteBody) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ClientInviteValues>({
    resolver: zodResolver(clientInviteSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  const onSubmit = async (values: ClientInviteValues) => {
    setServerError(null);
    const body = toClientInviteBody(values);
    try {
      const result = await invite(body);
      reset(EMPTY_INVITE);
      onInvited(result, body);
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        setError("email", {
          type: "server",
          message: "That email belongs to a staff account. Clients need their own email address.",
        });
        setFocus("email");
        return;
      }
      setServerError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FormField id="invite-email" label="Client's email" error={errors.email?.message} hint="They'll sign in with this email.">
        <LoginEmailInput
          disabled={isSubmitting}
          {...fieldAria("invite-email", errors.email?.message, "hint")}
          {...register("email")}
        />
      </FormField>
      <FormField id="invite-name" label="Client's name" error={errors.displayName?.message}>
        <Input
          {...NO_AUTOFILL}
          className="h-10"
          disabled={isSubmitting}
          {...fieldAria("invite-name", errors.displayName?.message)}
          {...register("displayName")}
        />
      </FormField>
      <FormField id="invite-phone" label="Phone (optional)" error={errors.phone?.message}>
        <Input
          {...NO_AUTOFILL}
          type="tel"
          inputMode="tel"
          className="h-10"
          disabled={isSubmitting}
          {...fieldAria("invite-phone", errors.phone?.message)}
          {...register("phone")}
        />
      </FormField>
      <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
        ) : (
          <Send data-icon="inline-start" aria-hidden />
        )}
        {isSubmitting ? "Creating invite…" : "Create invite link"}
      </Button>
    </form>
  );
}
