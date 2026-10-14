import { Construction } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageHeader } from "@/components/app-shell/page-header";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { StateMessage } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New project" };

/** Placeholder: the create form ships in Wave 2 (project module). */
export default function NewProjectPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <NewProjectContent />
    </Suspense>
  );
}

async function NewProjectContent() {
  await requireRole(["head", "manager"]);
  return (
    <div className="space-y-6">
      <SetBreadcrumbs items={[{ label: "Projects", href: "/app/projects" }, { label: "New project" }]} />
      <PageHeader title="New project" />
      <StateMessage
        icon={Construction}
        title="Project creation is coming soon"
        description="The single-page create form (with managers, workers and client) ships in the next release. Use the mobile app for now."
        action={
          <Link href="/app/projects" className={buttonVariants({ variant: "outline" })}>
            Back to projects
          </Link>
        }
      />
    </div>
  );
}
