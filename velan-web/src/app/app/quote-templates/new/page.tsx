import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { EditorSkeleton } from "@/components/sales-admin/sales-admin-skeleton";
import { TEMPLATES_FORBIDDEN, initialOf, loadCatalogAdmin } from "@/components/sales-admin/server";
import { TemplateEditor } from "@/components/sales-admin/template-editor";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New quote template" };

export default function NewQuoteTemplatePage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewQuoteTemplate />
    </Suspense>
  );
}

async function NewQuoteTemplate() {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") return <ForbiddenState message={TEMPLATES_FORBIDDEN} />;

  const catalog = await loadCatalogAdmin();
  if (catalog.kind === "forbidden") return <ForbiddenState message={TEMPLATES_FORBIDDEN} />;

  return <TemplateEditor initialCatalog={initialOf(catalog)} />;
}
