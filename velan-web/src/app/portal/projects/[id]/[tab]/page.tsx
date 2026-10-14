import { ArrowLeft, Construction } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Project" };

const LABELS: Record<string, string> = {
  updates: "Updates",
  designs: "Designs",
  timeline: "Timeline",
  support: "Support",
};

/** Placeholder for portal sections; Wave 2 adds real routes that take precedence. */
export default function PortalTabPlaceholder({ params }: PageProps<"/portal/projects/[id]/[tab]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <Placeholder params={params} />
    </Suspense>
  );
}

async function Placeholder({ params }: { params: PageProps<"/portal/projects/[id]/[tab]">["params"] }) {
  const { id, tab } = await params;
  const label = LABELS[tab];
  if (!label) notFound();

  const result = await loadProject(id);
  if (result.kind === "forbidden") {
    return <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />;
  }
  if (result.kind === "missing") notFound();
  const { project } = result;

  return (
    <div className="space-y-6">
      <SetBreadcrumbs items={[{ label: project.projectName, href: `/portal/projects/${project.id}` }, { label }]} />
      <Link href={`/portal/projects/${project.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft aria-hidden />
        {project.projectName}
      </Link>
      <StateMessage
        icon={Construction}
        title={`${label} is coming soon`}
        description="This section is coming to the web portal soon. Until then, use the Velan Spaces mobile app."
      />
    </div>
  );
}
