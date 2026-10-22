"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isApiError } from "@/lib/api/errors";
import {
  projectOps,
  projectOpsKeys,
  type TaskPatchBody,
  type TimelinePhase,
} from "@/lib/api/project-ops";

type Vars = { taskId: string; body: TaskPatchBody };

/**
 * `PATCH /projects/:id/timeline/tasks/:taskId` with an optimistic update of the
 * cached timeline. The server re-derives task/phase status and project completion,
 * so the timeline and project are refetched afterwards.
 */
export function useTaskProgress(projectId: string) {
  const queryClient = useQueryClient();
  const timelineKey = projectOpsKeys.timeline(projectId);

  return useMutation({
    mutationFn: ({ taskId, body }: Vars) => projectOps.patchTask(projectId, taskId, body),
    onMutate: async ({ taskId, body }) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<TimelinePhase[]>(timelineKey);
      queryClient.setQueryData<TimelinePhase[]>(timelineKey, (phases) =>
        phases?.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  ...(body.status ? { status: body.status } : {}),
                  ...(body.checklistItems ? { checklistItems: body.checklistItems } : {}),
                }
              : t,
          ),
        })),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(timelineKey, context.previous);
      toast.error(
        isApiError(error) && error.status === 403
          ? "You can only update tasks assigned to you."
          : isApiError(error)
            ? error.message
            : "Couldn't save the task. Please try again.",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timelineKey });
      void queryClient.invalidateQueries({ queryKey: projectOpsKeys.project(projectId), exact: true });
    },
  });
}
