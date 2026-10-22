import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { LeadDetail } from "@/components/sales/lead-detail";
import { canUseSales, loadLeadPage, personName } from "@/components/sales/server";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Lead" };

const FORBIDDEN = "Sales and quotations are available to the administrator and managers.";

export default function LeadPage({ params }: PageProps<"/app/sales/[leadId]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <LeadContent params={params} />
    </Suspense>
  );
}

async function LeadContent({ params }: { params: PageProps<"/app/sales/[leadId]">["params"] }) {
  const { leadId } = await params;
  if (!isUuid(leadId)) notFound();

  const user = await getSession();
  if (!user) return null; // the layout already redirected
  if (!canUseSales(user.role)) return <ForbiddenState message={FORBIDDEN} />;

  const result = await loadLeadPage(user, leadId);
  if (result.kind === "forbidden") return <ForbiddenState backHref="/app/sales" backLabel="Back to sales" />;
  if (result.kind === "missing") notFound();
  if (result.kind === "error") {
    return (
      <StateMessage
        icon={CloudOff}
        tone="warning"
        title="We couldn't load this lead"
        description="The server didn't respond as expected. Please try again in a moment."
        action={
          <Link href={`/app/sales/${leadId}`} className={buttonVariants({ variant: "outline" })}>
            Try again
          </Link>
        }
      />
    );
  }

  return (
    <LeadDetail
      initialLead={result.data.lead}
      initialQuotes={result.data.quotes}
      people={result.data.people}
      me={{ id: user.id, role: user.role, name: personName(user) }}
    />
  );
}
