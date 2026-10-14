import { cn } from "@/lib/utils";

/** Lightweight accessible progress bar (no JS), suitable for table rows. */
export function ProgressBar({
  value,
  label,
  showValue = true,
  tone = "default",
  className,
}: {
  /** 0–100; clamped. */
  value: number;
  label: string;
  showValue?: boolean;
  tone?: "default" | "danger" | "success";
  className?: string;
}) {
  const pct = Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            tone === "danger" ? "bg-destructive" : tone === "success" ? "bg-success" : "bg-gold",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showValue && <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>}
    </div>
  );
}
