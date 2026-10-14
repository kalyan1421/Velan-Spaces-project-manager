import { CircleCheck, CircleDashed, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { meterGeometry, type BudgetHealth, type BudgetStatus } from "@/lib/api/money";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Status scale (dataviz: status colours are reserved and always ship with an
 * icon + label). Fills are ink / warning / destructive on a lighter step of the
 * same hue, all ≥ 3:1 against the card; text never uses gold.
 */
const STATUS: Record<
  BudgetStatus,
  { label: string; icon: LucideIcon; fill: string; track: string; badge: "secondary" | "outline" | "destructive"; badgeClass?: string }
> = {
  "on-track": { label: "On track", icon: CircleCheck, fill: "bg-ink", track: "bg-ink/10", badge: "secondary" },
  "near-limit": {
    label: "Nearing budget",
    icon: TriangleAlert,
    fill: "bg-warning",
    track: "bg-warning/15",
    badge: "outline",
    badgeClass: "border-warning/40 text-warning",
  },
  "over-budget": {
    label: "Over budget",
    icon: OctagonAlert,
    fill: "bg-destructive",
    track: "bg-destructive/15",
    badge: "destructive",
  },
  "no-budget": { label: "No budget set", icon: CircleDashed, fill: "bg-ink", track: "bg-ink/10", badge: "outline" },
};

function formatPercentUsed(p: number | null): string {
  if (p === null) return "";
  return `${p % 1 === 0 ? p : p.toFixed(1)}%`;
}

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <Badge variant={s.badge} className={cn("h-6 px-2.5", s.badgeClass)}>
      <Icon aria-hidden />
      {s.label}
    </Badge>
  );
}

/** Spent vs budget. Scale = max(budget, spent); when over, a line marks the budget inside the bar. */
function BudgetMeter({ health }: { health: BudgetHealth }) {
  const { fillPercent, budgetMarkPercent } = meterGeometry(health);
  const s = STATUS[health.status];
  const over = health.status === "over-budget";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <div
          role="meter"
          aria-label="Budget used"
          aria-valuemin={0}
          aria-valuemax={Math.max(health.budget, health.spent)}
          aria-valuenow={health.spent}
          aria-valuetext={`${formatINR(health.spent)} spent of ${formatINR(health.budget)} (${formatPercentUsed(health.usedPercent)})`}
          className={cn("h-3 w-full overflow-hidden rounded-full", s.track)}
        >
          <div className={cn("h-full rounded-full transition-[width]", s.fill)} style={{ width: `${fillPercent}%` }} />
        </div>
        {over && budgetMarkPercent !== null && (
          <span
            aria-hidden
            className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-card"
            style={{ left: `${budgetMarkPercent}%` }}
          />
        )}
      </div>
      {over && (
        <p className="text-xs text-muted-foreground">
          The dark line marks the budget of {formatINR(health.budget)}.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-lg font-semibold text-ink", tone === "danger" && "text-destructive")}>{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Budget health: spent vs budget meter and the six summary figures from `GET …/budget/summary`. */
export function BudgetSummaryCard({ health, projectId }: { health: BudgetHealth; projectId: string }) {
  const over = health.status === "over-budget";
  const noBudget = health.status === "no-budget";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-heading text-base font-medium">Budget health</h2>
        </CardTitle>
        <CardDescription>
          Spent is settlements plus expenses. Income received is shown separately and doesn&apos;t reduce spend.
        </CardDescription>
        <CardAction>
          <BudgetStatusBadge status={health.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {noBudget ? (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            No budget is set for this project, so remaining money can&apos;t be tracked.{" "}
            <Link href={`/app/projects/${projectId}/edit`} className="font-medium text-ink underline underline-offset-4">
              Set a budget
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-heading text-3xl font-semibold text-ink">{formatINR(health.spent)}</span>{" "}
                spent of <span className="font-medium text-ink">{formatINR(health.budget)}</span>
              </p>
              <p className={cn("text-sm font-medium text-ink", over && "text-destructive")}>
                {formatPercentUsed(health.usedPercent)} used
              </p>
            </div>
            <BudgetMeter health={health} />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Budget" value={noBudget ? "Not set" : formatINR(health.budget)} />
          <Stat label="Spent" value={formatINR(health.spent)} />
          {noBudget ? (
            <Stat label="Remaining" value="—" />
          ) : over ? (
            <Stat label="Over budget by" value={formatINR(health.overBy)} tone="danger" />
          ) : (
            <Stat label="Remaining" value={formatINR(health.remaining)} />
          )}
          <Stat label="Settlements" value={formatINR(health.settlementsTotal)} />
          <Stat label="Expenses" value={formatINR(health.expenseTotal)} />
          <Stat label="Income received" value={formatINR(health.incomeTotal)} hint="Not counted in spend" />
        </dl>

        {health.estimatedCost > 0 && (
          <p className="text-xs text-muted-foreground">
            Estimated cost: <span className="font-medium text-ink">{formatINR(health.estimatedCost)}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
