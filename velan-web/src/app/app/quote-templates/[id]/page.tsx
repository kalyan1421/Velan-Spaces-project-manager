import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { EditorSkeleton } from "@/components/sales-admin/sales-admin-skeleton";
import { TEMPLATES_FORBIDDEN, initialOf, loadCatalogAdmin, loadTemplate } from "@/components/sales-admin/server";
import { TemplateEditor } from "@/components/sales-admin/template-editor";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Edit quote template" };

export default function EditQuoteTemplatePage({ params }: PageProps<"/app/quote-templates/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      {params.then(({ id }) => (
        <EditQuoteTemplate id={id} />
      ))}
    </Suspense>
  );
}

async function EditQuoteTemplate({ id }: { id: string }) {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") return <ForbiddenState message={TEMPLATES_FORBIDDEN} />;
  if (!isUuid(id)) notFound();

  const [template, catalog] = await Promise.all([loadTemplate(id), loadCatalogAdmin()]);
  if (template.kind === "forbidden") return <ForbiddenState message={TEMPLATES_FORBIDDEN} />;
  if (template.kind === "missing") notFound();
  // Rendered by app/app/error.tsx with a "Try again" button.
  if (template.kind === "unavailable") throw new Error("The quote template couldn't be loaded.");

  return <TemplateEditor key={template.data.id} template={template.data} initialCatalog={initialOf(catalog)} />;
}
