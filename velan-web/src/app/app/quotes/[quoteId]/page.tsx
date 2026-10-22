import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { QuoteBuilder } from "@/components/sales/quote-builder";
import { canUseSales, loadQuotePage } from "@/components/sales/server";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Quote" };

const FORBIDDEN = "Sales and quotations are available to the administrator and managers.";

/** Quote builder. The quote, rate card, templates and settings load on the server in parallel. */
export default function QuotePage({ params }: PageProps<"/app/quotes/[quoteId]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={10} />}>
      <QuoteContent params={params} />
    </Suspense>
  );
}

async function QuoteContent({ params }: { params: PageProps<"/app/quotes/[quoteId]">["params"] }) {
  const { quoteId } = await params;
  if (!isUuid(quoteId)) notFound();

  const user = await getSession();
  if (!user) return null; // the layout already redirected
  if (!canUseSales(user.role)) return <ForbiddenState message={FORBIDDEN} />;

  const result = await loadQuotePage(quoteId);
  if (result.kind === "forbidden") return <ForbiddenState backHref="/app/sales" backLabel="Back to sales" />;
  if (result.kind === "missing") notFound();
  if (result.kind === "error") {
    return (
      <StateMessage
        icon={CloudOff}
        tone="warning"
        title="We couldn't load this quote"
        description="The server didn't respond as expected. Please try again in a moment."
        action={
          <Link href={`/app/quotes/${quoteId}`} className={buttonVariants({ variant: "outline" })}>
            Try again
          </Link>
        }
      />
    );
  }

  const { quote, catalog, templates, settings, lead } = result.data;
  return (
    <QuoteBuilder
      key={quote.id}
      quote={quote}
      catalog={catalog}
      templates={templates}
      settings={settings}
      lead={lead}
      me={{ id: user.id, role: user.role }}
    />
  );
}
