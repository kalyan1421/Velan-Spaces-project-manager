"use client";

import { useId } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiscountType } from "@/lib/api/sales-types";
import { formatINR } from "@/lib/format";
import type { QuoteBreakdown } from "@/lib/quote-calc";
import { cn } from "@/lib/utils";
import { NumberInput } from "./number-input";

function Line({ label, value, muted }: { label: React.ReactNode; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", muted ? "text-muted-foreground" : "font-medium text-ink")}>{value}</dd>
    </div>
  );
}

/**
 * Live totals: subtotal → discount (₹ or %) → GST → round-off → grand total.
 * The figures mirror the API's maths; the server recomputes on every save.
 */
export function QuoteTotalsCard({
  breakdown,
  discountType,
  discountValue,
  gstPercent,
  discountError,
  gstError,
  onDiscountType,
  onDiscountValue,
  onGst,
  footer,
}: {
  breakdown: QuoteBreakdown;
  discountType: DiscountType;
  discountValue: number;
  gstPercent: number;
  discountError?: string;
  gstError?: string;
  onDiscountType: (type: DiscountType) => void;
  onDiscountValue: (value: number) => void;
  onGst: (value: number) => void;
  footer?: React.ReactNode;
}) {
  const ids = useId();
  const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${ids}-discount`} className="text-sm font-medium text-ink">
              Discount
            </label>
            <div role="group" aria-label="Discount type" className="inline-flex rounded-md bg-muted p-0.5">
              {(
                [
                  ["amount", "₹"],
                  ["percent", "%"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={discountType === value}
                  aria-label={value === "amount" ? "Discount in rupees" : "Discount in percent"}
                  onClick={() => onDiscountType(value)}
                  className={cn(
                    "h-6 min-w-8 rounded px-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    discountType === value ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <NumberInput
            id={`${ids}-discount`}
            value={discountValue}
            emptyValue={0}
            onValueChange={(v) => onDiscountValue(v ?? 0)}
            className="h-9 tabular-nums"
            placeholder="0"
            aria-invalid={discountError ? true : undefined}
            aria-describedby={discountError ? `${ids}-discount-error` : undefined}
          />
          {discountError && (
            <p id={`${ids}-discount-error`} className="text-xs font-medium text-destructive">
              {discountError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-gst`} className="text-sm font-medium text-ink">
            GST %
          </label>
          <NumberInput
            id={`${ids}-gst`}
            value={gstPercent}
            emptyValue={0}
            onValueChange={(v) => onGst(v ?? 0)}
            className="h-9 tabular-nums"
            placeholder="18"
            aria-invalid={gstError ? true : undefined}
            aria-describedby={gstError ? `${ids}-gst-error` : undefined}
          />
          {gstError && (
            <p id={`${ids}-gst-error`} className="text-xs font-medium text-destructive">
              {gstError}
            </p>
          )}
        </div>

        <dl className="border-t pt-2 text-sm">
          <Line label="Subtotal" value={formatINR(breakdown.subtotal)} />
          {breakdown.discount > 0 && (
            <Line
              label={discountType === "percent" ? `Discount (${pct(discountValue)})` : "Discount"}
              value={`− ${formatINR(breakdown.discount)}`}
            />
          )}
          {gstPercent > 0 && <Line label={`GST (${pct(gstPercent)})`} value={`+ ${formatINR(breakdown.gstAmount)}`} />}
          {breakdown.roundOff !== 0 && (
            <Line
              label="Round off"
              value={`${breakdown.roundOff > 0 ? "+" : "−"} ${formatINR(Math.abs(breakdown.roundOff))}`}
              muted
            />
          )}
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t pt-3">
            <dt className="font-heading text-base font-semibold text-ink">Grand total</dt>
            <dd className="font-heading text-xl font-semibold text-ink tabular-nums" aria-live="polite">
              {formatINR(Math.max(0, breakdown.payable))}
            </dd>
          </div>
        </dl>
        {footer}
      </CardContent>
    </Card>
  );
}
