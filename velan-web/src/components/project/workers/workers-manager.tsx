"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, Loader2, Pencil, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StateMessage } from "@/components/app-shell/states";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isApiError } from "@/lib/api/errors";
import { projectOps, projectOpsKeys, type Project } from "@/lib/api/project-ops";
import { AddWorkersDialog } from "./add-workers-dialog";
import { availableWorkers, withWorkers, withoutWorker, type Person } from "./workers-model";

export function WorkersManager({ initialProject, people }: { initialProject: Project; people: Person[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = initialProject.id;
  const [removing, setRemoving] = useState<Person | null>(null);

  const { data: project } = useQuery({
    queryKey: projectOpsKeys.project(projectId),
    queryFn: () => projectOps.getProject(projectId),
    initialData: initialProject,
  });

  const workerIds = useMemo(() => project.workerIds ?? [], [project.workerIds]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const assigned = workerIds.map(
    (id): Person => byId.get(id) ?? { id, name: "Unknown worker", role: "worker", trade: null, phone: null, suspended: false },
  );
  const available = availableWorkers(people, workerIds);

  const update = useMutation({
    // Managers may only send workerIds; the API ignores echoed lists, so send only this one.
    mutationFn: (ids: string[]) => projectOps.updateProject(projectId, { workerIds: ids }),
    onSuccess: (saved) => {
      queryClient.setQueryData(projectOpsKeys.project(projectId), saved);
      router.refresh();
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : "Couldn't update the team. Please try again.");
    },
  });

  const add = async (ids: string[]) => {
    try {
      await update.mutateAsync(withWorkers(workerIds, ids));
      toast.success(ids.length === 1 ? "Worker added." : `${ids.length} workers added.`);
      return true;
    } catch {
      return false;
    }
  };

  const remove = async (person: Person) => {
    try {
      await update.mutateAsync(withoutWorker(workerIds, person.id));
      toast.success(`${person.name} removed from this project.`);
      setRemoving(null);
    } catch {
      // toast shown by onError; keep the dialog open
    }
  };

  return (
    <section aria-labelledby="workers-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="workers-heading" className="font-heading text-lg font-semibold text-ink">
            Workers
          </h2>
          <p className="text-sm text-muted-foreground">
            {assigned.length === 0
              ? "No workers on this project yet."
              : `${assigned.length} ${assigned.length === 1 ? "worker" : "workers"} on this project.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/projects/${projectId}/edit#members`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Pencil data-icon="inline-start" />
            Edit team
          </Link>
          <AddWorkersDialog available={available} pending={update.isPending} onAdd={add} />
        </div>
      </div>

      {assigned.length === 0 ? (
        <StateMessage
          icon={HardHat}
          title="No workers assigned"
          description="Add workers so they can see this project and the tasks assigned to them."
        />
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigned.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 font-medium text-ink">
                    <span className="inline-flex items-center gap-2">
                      {p.name}
                      {p.suspended && <Badge variant="destructive">Suspended</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.trade ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {p.phone ? (
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-4 hover:underline">
                        {p.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(p)} disabled={update.isPending}>
                      <UserMinus data-icon="inline-start" />
                      Remove
                      <span className="sr-only"> {p.name}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={removing !== null} onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name} from this project?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to the project straight away. Timeline tasks assigned to them need a new assignee before
              the timeline can be saved again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={update.isPending} onClick={() => removing && void remove(removing)}>
              {update.isPending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
              Remove worker
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
