import type { LucideIcon } from "lucide-react";
import { Inbox, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/auth/links";
import { cn } from "@/lib/utils";

/** Centered message block for empty, forbidden and error states. */
export function StateMessage({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  tone = "neutral",
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full",
          tone === "warning" ? "bg-gold/20 text-ink" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 font-heading text-base font-semibold text-ink">{title}</h2>
      {description && <div className="mt-1 max-w-md text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Shown when the API answers 403 for something the user navigated to. */
export function ForbiddenState({
  backHref = "/app/projects",
  backLabel = "Back to projects",
  message = "Your account doesn't have access to this. If you think it should, ask your administrator.",
}: {
  backHref?: string;
  backLabel?: string;
  message?: string;
}) {
  return (
    <StateMessage
      icon={ShieldAlert}
      tone="warning"
      title="You don't have access to this page"
      description={message}
      action={
        <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
          {backLabel}
        </Link>
      }
    />
  );
}

export function SupportLink({ className }: { className?: string }) {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={cn("font-medium text-ink underline underline-offset-4", className)}>
      {SUPPORT_EMAIL}
    </a>
  );
}
