"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { CurrentPerson } from "@/components/project/budget/expense-ledger";
import { MoneyForbidden, StaleDataAlert } from "@/components/project/budget/money-states";
import { isForbidden, useSettlements } from "@/components/project/budget/queries";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettlementRow } from "@/lib/api/money";
import { formatDate, formatINR } from "@/lib/format";
import { summarizeSettlements } from "./settlement-ledger";
import { SettlementsSection } from "./settlements-section";

/** Settlements tab: all-time totals plus the payments table. */
export function SettlementsView({
  projectId,
  projectCode,
  me,
  initialSettlements,
}: {
  projectId: string;
  projectCode: string;
  me: CurrentPerson;
  initialSettlements: SettlementRow[];
}) {
  const query = useSettlements(projectId, initialSettlements);
  const settlements = query.data;
  const totals = useMemo(() => summarizeSettlements(settlements), [settlements]);
  const latest = useMemo(
    () => settlements.reduce<string>((max, s) => (s.date > max ? s.date : max), ""),
    [settlements],
  );

  if (isForbidden(query.error)) return <MoneyForbidden projectId={projectId} />;

  return (
    <div className="flex flex-col gap-6">
      {query.isError && <StaleDataAlert retrying={query.isFetching} onRetry={() => void query.refetch()} />}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-base font-medium">Settlements</h2>
          </CardTitle>
          <CardDescription>Payments made to vendors and workers. They count towards the project&apos;s spend.</CardDescription>
          <CardAction>
            <Link
              href={`/app/projects/${projectId}/budget`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Budget health
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Total settled</dt>
              <dd className="truncate text-lg font-semibold text-ink">{formatINR(totals.total)}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Payments</dt>
              <dd className="text-lg font-semibold text-ink">{totals.count}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Latest payment</dt>
              <dd className="text-lg font-semibold text-ink">{latest ? formatDate(latest) : "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <SettlementsSection projectId={projectId} projectCode={projectCode} me={me} settlements={settlements} />
    </div>
  );
}
