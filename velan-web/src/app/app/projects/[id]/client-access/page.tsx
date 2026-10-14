import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { ClientAccessPanel } from "@/components/project/client-access/client-access-panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientInvite } from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { loadProject } from "@/lib/data/load-project";

export const metadata: Metadata = { title: "Client access" };

export default function ClientAccessPage({ params }: PageProps<"/app/projects/[id]/client-access">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 lg:grid-cols-5" aria-busy="true">
          <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-xl lg:col-span-3" />
        </div>
      }
    >
      <ClientAccess params={params} />
    </Suspense>
  );
}

async function ClientAccess({ params }: { params: PageProps<"/app/projects/[id]/client-access">["params"] }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), loadProject(id)]);
  // The project layout renders the 403 state; nothing more to show here.
  if (result.kind === "forbidden") return null;
  if (result.kind === "missing" || !user) notFound();

  // Head, or a manager on this project (the API enforces membership too).
  if (user.role !== "head" && user.role !== "manager") {
    return <ForbiddenState backHref={`/app/projects/${id}`} backLabel="Back to project" />;
  }

  let invites: ClientInvite[];
  try {
    const list = await apiFetch<ClientInvite[] | null>(`projects/${id}/client-invites`);
    invites = Array.isArray(list) ? list : [];
  } catch (error) {
    if (isApiError(error) && error.status === 403) {
      return (
        <ForbiddenState
          backHref={`/app/projects/${id}`}
          backLabel="Back to project"
          message="Only the administrator and this project's managers can invite clients."
        />
      );
    }
    throw error;
  }

  const { project } = result;
  return <ClientAccessPanel projectId={project.id} projectName={project.projectName} initialInvites={invites} />;
}
