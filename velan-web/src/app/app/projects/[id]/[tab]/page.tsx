import { Construction } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StateMessage } from "@/components/app-shell/states";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";
import { projectTabsFor } from "@/lib/projects";

export const metadata: Metadata = { title: "Project" };

/**
 * Placeholder for project tabs not built yet. Wave 2 adds real routes
 * (`updates/page.tsx`, …), which take precedence over this dynamic segment.
 */
export default function ProjectTabPlaceholder({ params }: PageProps<"/app/projects/[id]/[tab]">) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
      <Placeholder params={params} />
    </Suspense>
  );
}

async function Placeholder({ params }: { params: PageProps<"/app/projects/[id]/[tab]">["params"] }) {
  const { id, tab } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();

  const match = projectTabsFor(user.role, result.project).find((t) => t.key === tab);
  if (!match || match.key === "overview") notFound();

  return (
    <StateMessage
      icon={Construction}
      title={`${match.label} is coming soon`}
      description="This section is being rebuilt for the web. Until then, use the Velan Spaces mobile app."
    />
  );
}
