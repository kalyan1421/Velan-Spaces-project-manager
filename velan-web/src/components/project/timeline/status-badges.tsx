import { Ban, CircleCheck, CircleDashed, CircleDot, Flag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PhaseStatus, TaskPriority, TaskStatus } from "@/lib/api/project-ops";
import { cn } from "@/lib/utils";
import { PHASE_STATUS_LABEL, PRIORITY_LABEL, TASK_STATUS_LABEL } from "./timeline-model";

const TASK_ICON: Record<TaskStatus, { icon: LucideIcon; tone: string }> = {
  pending: { icon: CircleDashed, tone: "text-muted-foreground" },
  inProgress: { icon: CircleDot, tone: "text-warning" },
  blocked: { icon: Ban, tone: "text-destructive" },
  done: { icon: CircleCheck, tone: "text-success" },
};

/** Icon + text, so status never relies on colour alone. */
export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const { icon: Icon, tone } = TASK_ICON[status];
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className={tone} aria-hidden />
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PhaseStatusBadge({ status }: { status: PhaseStatus }) {
  return (
    <Badge variant={status === "completed" ? "secondary" : "outline"}>
      {status === "completed" ? <CircleCheck className="text-success" aria-hidden /> : null}
      {PHASE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "medium") return null;
  return (
    <Badge variant={priority === "high" ? "destructive" : "ghost"} className="gap-1">
      <Flag aria-hidden />
      {PRIORITY_LABEL[priority]} priority
    </Badge>
  );
}
