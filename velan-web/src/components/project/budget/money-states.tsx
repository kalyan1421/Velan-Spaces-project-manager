"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** 403 from a money endpoint: managers without budget access, workers, clients. */
export function MoneyForbidden({ projectId }: { projectId: string }) {
  return (
    <ForbiddenState
      backHref={`/app/projects/${projectId}`}
      backLabel="Back to project"
      message="Budget and settlements are only visible to the admin and to managers who have budget access on this project."
    />
  );
}

/** First load failed (network / 5xx): retry re-renders the server page. */
export function MoneyLoadError({ what }: { what: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <StateMessage
      icon={TriangleAlert}
      tone="warning"
      title={`Couldn't load ${what}`}
      description="It may be a temporary problem with the server. Your data is safe."
      action={
        <Button disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          <RotateCcw className={pending ? "animate-spin" : undefined} aria-hidden />
          {pending ? "Retrying…" : "Try again"}
        </Button>
      }
    />
  );
}

/** A background refresh failed; the figures shown may be out of date. */
export function StaleDataAlert({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertDescription>Couldn&apos;t refresh the latest figures. What you see may be out of date.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
          <RotateCcw className={retrying ? "animate-spin" : undefined} aria-hidden />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  );
}
