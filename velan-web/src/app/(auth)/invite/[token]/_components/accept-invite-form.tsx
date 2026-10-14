"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserRoundCheck } from "lucide-react";
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
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  isLinkState,
  passwordSchema,
  type InviteLinkDetails,
  type LinkState,
} from "@/lib/api/accounts";
import { fetchJson } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { loginUrl } from "@/lib/auth/redirects";
import { formatDateTime } from "@/lib/format";
import { AuthHeading } from "../../../_components/auth-heading";

const schema = z
  .object({
    displayName: z.string().trim().min(1, "Enter your name.").max(NAME_MAX, "That name is too long."),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

type Values = z.infer<typeof schema>;
type Screen = { kind: "form" } | { kind: "problem"; state: LinkState } | { kind: "exists" };

/** Invite acceptance: set a name + password, then land in the client portal. */
export function AcceptInvite({ token, invite }: { token: string; invite: InviteLinkDetails }) {
  const [screen, setScreen] = useState<Screen>({ kind: "form" });

  if (screen.kind === "problem") return <AccountLinkProblem kind="invite" state={screen.state} />;
  if (screen.kind === "exists") return <AccountExists email={invite.email} />;

  return (
    <>
      <AuthHeading
        title="Welcome to Velan Spaces"
        description={
          invite.projectName
            ? `Create your account to follow ${invite.projectName}.`
            : "Create your account to follow your project."
        }
      />
      <InviteForm
        token={token}
        invite={invite}
        onProblem={(state) => setScreen({ kind: "problem", state })}
        onExists={() => setScreen({ kind: "exists" })}
      />
    </>
  );
}

function AccountExists({ email }: { email: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-ink">
        <UserRoundCheck className="size-5" aria-hidden />
      </span>
      <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">You already have an account — sign in</h1>
      <p className="text-sm text-muted-foreground">
        {email ? (
          <>
            <span className="font-medium text-ink">{email}</span> already has a Velan Spaces account.
          </>
        ) : (
          "This email already has a Velan Spaces account."
        )}{" "}
        Sign in with your existing password. If you can&apos;t see this project afterwards, ask the person who invited
        you.
      </p>
      <Link href={loginUrl("/portal")} className={buttonVariants({ size: "lg", className: "h-10 w-full" })}>
        Sign in
      </Link>
    </div>
  );
}

function InviteForm({
  token,
  invite,
  onProblem,
  onExists,
}: {
  token: string;
  invite: InviteLinkDetails;
  onProblem: (state: LinkState) => void;
  onExists: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: invite.displayName ?? "", password: "", confirm: "" },
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      const result = await fetchJson<{ redirectTo: string }>(`/api/auth/invite/${token}`, {
        body: { displayName: values.displayName, password: values.password },
      });
      setRedirecting(true);
      // Full navigation so the portal renders with the new session cookies.
      window.location.assign(result.redirectTo);
    } catch (e) {
      if (isApiError(e) && e.code === "account-exists") return onExists();
      if (isApiError(e) && isLinkState(e.code) && e.code !== "error") return onProblem(e.code);
      setError(isApiError(e) ? e.message : "Something went wrong. Please try again.");
      setFocus("password");
    }
  };

  const busy = isSubmitting || redirecting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {invite.projectName && (
        <div className="rounded-lg bg-muted px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Project</p>
          <p className="text-sm font-medium text-ink">{invite.projectName}</p>
        </div>
      )}

      {invite.email && (
        <FormField id="email" label="Email" hint="You'll sign in with this email.">
          {/* Read-only, but present so password managers save the right username. */}
          <Input
            type="email"
            value={invite.email}
            readOnly
            autoComplete="username"
            className="h-10 bg-muted"
            {...fieldAria("email", undefined, "hint")}
          />
        </FormField>
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
        hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters. Only you will know it.`}
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

      {invite.expiresAt && (
        <p className="text-center text-xs text-muted-foreground">This invite expires on {formatDateTime(invite.expiresAt)}.</p>
      )}
    </form>
  );
}
