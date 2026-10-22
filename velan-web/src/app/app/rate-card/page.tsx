import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { RateCard } from "@/components/sales-admin/rate-card";
import { ListSkeleton } from "@/components/sales-admin/sales-admin-skeleton";
import { initialOf, loadCatalogAdmin, loadTemplates } from "@/components/sales-admin/server";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Rate card" };

/** Head: manage the rate card. Managers: read-only view (they price quotes from it). */
export default function RateCardPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <RateCardContent />
    </Suspense>
  );
}

async function RateCardContent() {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role === "worker") return <ForbiddenState message="The rate card is only for the sales team." />;
  const readOnly = user.role !== "head";

  const [catalog, templates] = await Promise.all([
    loadCatalogAdmin(),
    readOnly ? Promise.resolve(null) : loadTemplates(),
  ]);
  if (catalog.kind === "forbidden") return <ForbiddenState message="Your account can't view the rate card." />;

  // "unavailable": the client fetches again and shows its own error + retry.
  return (
    <RateCard
      readOnly={readOnly}
      initialItems={initialOf(catalog)}
      initialTemplates={templates ? initialOf(templates) : undefined}
    />
  );
}
