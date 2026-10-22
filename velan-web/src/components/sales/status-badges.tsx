import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  leadSourceLabel,
  leadStatusLabel,
  quoteStatusLabel,
  type LeadStatus,
  type QuoteStatus,
} from "@/lib/api/sales-types";
import { cn } from "@/lib/utils";

/** Light fills with dark text (AA on white); the dot carries the hue for scanning. */
const LEAD_TONES: Record<LeadStatus, { pill: string; dot: string }> = {
  new: { pill: "bg-sky-50 text-sky-900 ring-sky-200", dot: "bg-sky-500" },
  contacted: { pill: "bg-violet-50 text-violet-900 ring-violet-200", dot: "bg-violet-500" },
  site_visit: { pill: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500" },
  proposal_sent: { pill: "bg-pink-50 text-pink-900 ring-pink-200", dot: "bg-pink-500" },
  won: { pill: "bg-emerald-50 text-emerald-900 ring-emerald-200", dot: "bg-emerald-600" },
  lost: { pill: "bg-zinc-100 text-zinc-700 ring-zinc-200", dot: "bg-zinc-400" },
};

const QUOTE_TONES: Record<QuoteStatus, { pill: string; dot: string }> = {
  draft: { pill: "bg-zinc-100 text-zinc-700 ring-zinc-200", dot: "bg-zinc-400" },
  sent: { pill: "bg-sky-50 text-sky-900 ring-sky-200", dot: "bg-sky-500" },
  accepted: { pill: "bg-emerald-50 text-emerald-900 ring-emerald-200", dot: "bg-emerald-600" },
  rejected: { pill: "bg-rose-50 text-rose-900 ring-rose-200", dot: "bg-rose-500" },
};

const FALLBACK = { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/60" };

export function leadStatusDot(status: string): string {
  return (LEAD_TONES as Record<string, { dot: string }>)[status]?.dot ?? FALLBACK.dot;
}

function Pill({ tone, label, className }: { tone: { pill: string; dot: string }; label: string; className?: string }) {
  return (
    <Badge className={cn("gap-1.5 ring-1 ring-inset", tone.pill, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </Badge>
  );
}

export function LeadStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = (LEAD_TONES as Record<string, { pill: string; dot: string }>)[status] ?? FALLBACK;
  return <Pill tone={tone} label={leadStatusLabel(status)} className={className} />;
}

export function QuoteStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = (QUOTE_TONES as Record<string, { pill: string; dot: string }>)[status] ?? FALLBACK;
  return <Pill tone={tone} label={quoteStatusLabel(status)} className={className} />;
}

/** Website enquiries get the brand accent so they stand out in the pipeline. */
export function SourceBadge({ source, className }: { source: string | null; className?: string }) {
  if (!source) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const website = source.toLowerCase() === "website";
  return (
    <Badge
      variant="outline"
      className={cn(website && "border-transparent bg-sun/40 text-ink", "font-normal", className)}
    >
      {website && <Globe aria-hidden />}
      {leadSourceLabel(source)}
    </Badge>
  );
}
