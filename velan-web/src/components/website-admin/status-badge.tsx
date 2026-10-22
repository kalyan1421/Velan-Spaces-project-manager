import { EyeOff, Globe, PencilLine, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PortfolioStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "./portfolio-rules";

const ICONS: Record<PortfolioStatus, LucideIcon> = {
  published: Globe,
  draft: PencilLine,
  hidden: EyeOff,
};

/** Status with an icon as well as colour, so it reads without colour vision. */
export function PortfolioStatusBadge({ status, className }: { status: PortfolioStatus; className?: string }) {
  const Icon = ICONS[status];
  return (
    <Badge
      variant={status === "hidden" ? "outline" : "secondary"}
      className={cn(status === "published" && "bg-success/10 text-success", status === "hidden" && "text-muted-foreground", className)}
    >
      <Icon data-icon="inline-start" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
