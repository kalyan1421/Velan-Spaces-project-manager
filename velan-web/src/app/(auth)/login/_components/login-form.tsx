"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField, PasswordField, fieldAria } from "@/components/app-shell/password-field";
import { SupportLink } from "@/components/app-shell/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { GoogleButton } from "./google-button";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username.").max(254),
  password: z.string().min(1, "Enter your password.").max(128),
});

type Values = z.infer<typeof schema>;
type SignInResult = { redirectTo: string };

export function LoginForm({
  next,
  notice,
  googleClientId,
}: {
  next: string | null;
  notice: string | null;
  googleClientId: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "" } });

  const busy = isSubmitting || redirecting || googlePending;

  const finish = (result: SignInResult) => {
    setRedirecting(true);
    // Full navigation so every layout re-renders with the new session.
    window.location.assign(result.redirectTo);
  };

  const fail = (e: unknown) => {
    setError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
  };

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      finish(await fetchJson<SignInResult>("/api/auth/login", { body: { ...values, next: next ?? undefined } }));
    } catch (e) {
      fail(e);
      setFocus("password");
    }
  };

  const onGoogle = async (idToken: string) => {
    setError(null);
    setGooglePending(true);
    try {
      finish(await fetchJson<SignInResult>("/api/auth/google", { body: { idToken, next: next ?? undefined } }));
    } catch (e) {
      fail(e);
      setGooglePending(false);
    }
  };

  return (
    <div className="space-y-5">
      {(error || notice) && (
        <Alert variant={error ? "destructive" : "default"} aria-live="assertive">
          <AlertDescription>{error ?? notice}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField id="identifier" label="Email or username" error={errors.identifier?.message}>
          <Input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-10"
            disabled={busy}
            {...fieldAria("identifier", errors.identifier?.message)}
            {...register("identifier")}
          />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message}>
          <PasswordField
            autoComplete="current-password"
            disabled={busy}
            {...fieldAria("password", errors.password?.message)}
            {...register("password")}
          />
        </FormField>
        <Button type="submit" size="lg" className="h-10 w-full" disabled={busy}>
          {(isSubmitting || redirecting) && <Loader2 className="animate-spin" aria-hidden />}
          {redirecting ? "Signing you in…" : isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {googleClientId && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton clientId={googleClientId} disabled={busy} onCredential={onGoogle} />
        </div>
      )}

      <div className="space-y-2 border-t pt-4 text-center text-xs text-muted-foreground">
        <p>Forgot your password? Ask your administrator for a reset link.</p>
        <p>
          Client? Use the invite link we sent you. Can&apos;t find it? Email <SupportLink />.
        </p>
      </div>
    </div>
  );
}
