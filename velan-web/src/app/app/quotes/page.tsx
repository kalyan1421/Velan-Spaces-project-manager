import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { QuotationsList } from "@/components/sales/quotations-list";
import { canUseSales, loadAllQuotes, personName } from "@/components/sales/server";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Quotations" };

const FORBIDDEN = "Quotations are available to the administrator and managers.";

/** All quotations, for any person — with or without a lead. */
export default function QuotationsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <QuotationsContent />
    </Suspense>
  );
}

async function QuotationsContent() {
  const user = await getSession();
  if (!user) return null; // the layout already redirected
  if (!canUseSales(user.role)) return <ForbiddenState message={FORBIDDEN} />;

  const result = await loadAllQuotes();
  if (result.kind === "forbidden") return <ForbiddenState message={FORBIDDEN} />;
  if (result.kind !== "ok") {
    return (
      <StateMessage
        icon={CloudOff}
        tone="warning"
        title="We couldn't load the quotations"
        description="The server didn't respond as expected. Please try again in a moment."
        action={
          <Link href="/app/quotes" className={buttonVariants({ variant: "outline" })}>
            Try again
          </Link>
        }
      />
    );
  }

  return <QuotationsList initialQuotes={result.data.quotes} handledBy={personName(user)} />;
}
