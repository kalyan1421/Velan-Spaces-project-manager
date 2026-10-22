import { ChevronDown, Wallet } from "lucide-react";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatINR, formatPercent } from "@/lib/format";
import { paymentStanding, type ClientPayments } from "./client-payments";

/**
 * Client portal: the agreed budget vs payments received, with a progress bar
 * and the payment history. Only these figures — never spend or costs (R-B3).
 */
export function ClientPaymentsCard({ data }: { data: ClientPayments }) {
  const standing = paymentStanding(data);
  const percent = data.receivedPercent ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" aria-hidden />
          Payments
        </CardTitle>
        {standing.kind === "paid" || standing.kind === "ahead" ? (
          <Badge variant="secondary">Fully paid</Badge>
        ) : standing.kind === "partial" ? (
          <Badge variant="outline">{formatPercent(percent)} paid</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {standing.kind === "no-budget" ? (
          <p className="text-sm text-muted-foreground">
            Your project budget hasn&apos;t been finalised yet. It will show here once the team sets it.
          </p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-heading text-3xl font-semibold tabular-nums text-ink">{formatINR(data.received)}</span>
              <span className="text-sm text-muted-foreground">paid of {formatINR(data.budget)}</span>
            </p>
            <ProgressBar
              value={percent}
              label="Payments received against the project budget"
              tone={standing.kind === "paid" || standing.kind === "ahead" ? "success" : "default"}
            />
          </>
        )}

        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3">
          <div>
            <dt className="text-xs text-muted-foreground">Total budget</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink">{data.budget > 0 ? formatINR(data.budget) : "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Received</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink">{formatINR(data.received)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{standing.kind === "ahead" ? "Paid ahead" : "Balance"}</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink">
              {standing.kind === "no-budget"
                ? "—"
                : standing.kind === "ahead"
                  ? formatINR(standing.ahead)
                  : formatINR(Math.max(0, data.balance))}
            </dd>
          </div>
        </dl>

        {data.payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <details className="group rounded-xl ring-1 ring-foreground/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              Payment history ({data.payments.length})
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="divide-y border-t">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{formatDate(p.date)}</span>
                    {p.paymentMethod && <span className="block truncate text-xs text-muted-foreground">{p.paymentMethod}</span>}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatINR(p.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
