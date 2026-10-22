import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { PortfolioAdmin } from "@/components/website-admin/portfolio-admin";
import { PortfolioListSkeleton } from "@/components/website-admin/website-skeleton";
import { requireRole } from "@/lib/auth/session";
import { loadPortfolioAdmin } from "./_lib/data";

export const metadata: Metadata = { title: "Website" };

/** Head only: manage the public site's portfolio (R-D13). */
export default function WebsitePage() {
  return (
    <Suspense fallback={<PortfolioListSkeleton />}>
      <WebsiteContent />
    </Suspense>
  );
}

async function WebsiteContent() {
  // Signed-out → login (the layout does the same); managers/workers see the 403 state.
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") return <ForbiddenState message="Only the admin can manage the website portfolio." />;

  const portfolio = await loadPortfolioAdmin();
  if (portfolio.kind === "forbidden") return <ForbiddenState />;

  // "unavailable": the client fetches again and shows its own error + retry.
  return <PortfolioAdmin initialItems={portfolio.kind === "ok" ? portfolio.data : undefined} />;
}
