"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { projectOps, projectOpsKeys } from "@/lib/api/project-ops";
import { DELETE_CASCADE, DELETE_KEPT, canConfirmDelete } from "./project-form-schema";

/**
 * Head-only "danger zone": deleting a project cascades every row that belongs to
 * it (see DELETE_CASCADE), so the button stays disabled until the exact project
 * code is typed. On success, returns to the project list.
 */
export function DeleteProjectSection({
  projectId,
  projectCode,
  projectName,
}: {
  projectId: string;
  projectCode: string;
  projectName: string;
}) {
  const id = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = canConfirmDelete(typed, projectCode);

  const onOpenChange = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  };

  const onDelete = async () => {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    try {
      await projectOps.deleteProject(projectId);
      queryClient.removeQueries({ queryKey: projectOpsKeys.project(projectId) });
      toast.success(`${projectName} deleted`);
      router.replace("/app/projects");
      router.refresh();
    } catch (e) {
      setPending(false);
      if (isApiError(e) && e.status === 404) {
        // Already gone (deleted elsewhere): nothing left to do here.
        router.replace("/app/projects");
        router.refresh();
        return;
      }
      setError(
        isApiError(e) && e.status === 403
          ? "Only the administrator can delete projects."
          : isApiError(e)
            ? e.message
            : "Couldn't delete the project. Please try again.",
      );
    }
  };

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="min-w-0">
        <h2 id={`${id}-heading`} className="font-heading text-base font-semibold text-ink">
          Delete this project
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Permanently removes the project and everything recorded in it. This can&apos;t be undone.
        </p>
      </div>
      <Button type="button" variant="destructive" size="lg" className="w-full sm:w-fit" onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" aria-hidden />
        Delete project
      </Button>

      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto data-[size=default]:sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {projectName}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the project and can&apos;t be undone. It removes:</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {DELETE_CASCADE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <p className="font-medium text-ink">What stays</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {DELETE_KEPT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void onDelete();
            }}
          >
            <label htmlFor={`${id}-code`} className="text-sm text-ink">
              Type the project code <span className="rounded bg-muted px-1 py-0.5 font-mono font-medium">{projectCode}</span> to
              confirm.
            </label>
            <Input
              id={`${id}-code`}
              className="h-10 font-mono"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </form>
          {error && (
            <Alert variant="destructive" id={`${id}-error`} aria-live="assertive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep project</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={!ready || pending} onClick={() => void onDelete()}>
              {pending ? (
                <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden />
              )}
              {pending ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
