import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { ListSkeleton } from "@/components/sales-admin/sales-admin-skeleton";
import { TEMPLATES_FORBIDDEN, initialOf, loadCatalogAdmin, loadTemplates } from "@/components/sales-admin/server";
import { TemplatesList } from "@/components/sales-admin/templates-list";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Quote templates" };

/** Head only: reusable quote templates. */
export default function QuoteTemplatesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <QuoteTemplatesContent />
    </Suspense>
  );
}

async function QuoteTemplatesContent() {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") return <ForbiddenState message={TEMPLATES_FORBIDDEN} />;

  const [templates, catalog] = await Promise.all([loadTemplates(), loadCatalogAdmin()]);
  if (templates.kind === "forbidden") return <ForbiddenState message={TEMPLATES_FORBIDDEN} />;

  return <TemplatesList initialTemplates={initialOf(templates)} initialCatalog={initialOf(catalog)} />;
}
