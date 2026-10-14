import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { SupportView } from "@/components/project/support/support-view";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Support" };

export default function ProjectSupportPage({ params }: PageProps<"/app/projects/[id]/support">) {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <SupportContent params={params} />
    </Suspense>
  );
}

/**
 * Staff support tab. Chat and complaints load client-side (polled), so only the
 * membership check happens here. Workers can read and post in chat (as on mobile)
 * but only head/managers change complaint status (API-enforced).
 */
async function SupportContent({ params }: { params: PageProps<"/app/projects/[id]/support">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") return null; // the layout shows the 403 state
  if (result.kind === "missing" || !user) notFound();
  return <SupportView projectId={result.project.id} viewer={{ id: user.id, role: user.role }} />;
}
