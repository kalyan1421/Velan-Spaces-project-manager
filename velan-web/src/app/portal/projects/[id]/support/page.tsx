import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { SupportView } from "@/components/project/support/support-view";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Support" };

/** Client portal support: chat with attachments, raise a complaint, follow its status (R-E2). */
export default function PortalSupportPage({ params }: PageProps<"/portal/projects/[id]/support">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <PortalSupport params={params} />
    </Suspense>
  );
}

async function PortalSupport({ params }: { params: PageProps<"/portal/projects/[id]/support">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") {
    return <ForbiddenState backHref="/portal" backLabel="Back to your projects" message="This project isn't on your account." />;
  }
  if (result.kind === "missing" || !user) notFound();
  const { project } = result;

  return (
    <div className="flex flex-col gap-4">
      <SetBreadcrumbs items={[{ label: project.projectName, href: `/portal/projects/${project.id}` }, { label: "Support" }]} />
      <Link href={`/portal/projects/${project.id}`} className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}>
        <ArrowLeft aria-hidden />
        {project.projectName}
      </Link>
      <SupportView projectId={project.id} viewer={{ id: user.id, role: user.role }} />
    </div>
  );
}
