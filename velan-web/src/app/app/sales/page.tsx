import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { LeadsPipeline } from "@/components/sales/leads-pipeline";
import { canUseSales, loadPipeline } from "@/components/sales/server";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sales" };

const FORBIDDEN = "Sales and quotations are available to the administrator and managers.";

export default function SalesPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <SalesContent />
    </Suspense>
  );
}

async function SalesContent() {
  const user = await getSession();
  if (!user) return null; // the layout already redirected
  if (!canUseSales(user.role)) return <ForbiddenState message={FORBIDDEN} />;

  const result = await loadPipeline(user);
  if (result.kind === "forbidden") return <ForbiddenState message={FORBIDDEN} />;
  if (result.kind !== "ok") {
    return (
      <StateMessage
        icon={CloudOff}
        tone="warning"
        title="We couldn't load your leads"
        description="The server didn't respond as expected. Please try again in a moment."
        action={
          <Link href="/app/sales" className={buttonVariants({ variant: "outline" })}>
            Try again
          </Link>
        }
      />
    );
  }

  return <LeadsPipeline initialLeads={result.data.leads} people={result.data.people} meId={user.id} />;
}
