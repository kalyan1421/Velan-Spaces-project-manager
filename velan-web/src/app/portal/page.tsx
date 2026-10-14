import { CalendarDays, FolderOpen, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { StateMessage, SupportLink } from "@/components/app-shell/states";
import { getProjects } from "@/lib/data/projects";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Your projects" };

export default function PortalHome() {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <PortalProjects />
    </Suspense>
  );
}

async function PortalProjects() {
  const projects = await getProjects();

  if (projects.length === 1) redirect(`/portal/projects/${projects[0].id}`);

  if (projects.length === 0) {
    return (
      <StateMessage
        icon={FolderOpen}
        title="Your project isn't linked yet"
        description={
          <>
            We couldn&apos;t find a project on your account. If you were expecting one, email <SupportLink /> and
            we&apos;ll sort it out.
          </>
        }
      />
    );
  }

  // Never show money here: clients don't see budget or spend, even if a field leaks.
  return (
    <div className="space-y-6">
      <PageHeader title="Your projects" description="Choose a project to see its progress." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/portal/projects/${p.id}`}
              className="block rounded-xl bg-card p-5 ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <p className="font-heading text-lg font-semibold text-ink">{p.projectName}</p>
              <p className="font-mono text-xs text-muted-foreground">{p.projectCode}</p>
              <ProgressBar className="mt-4" value={p.completionPercentage} label={`${p.projectName} progress`} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {p.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {p.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Target {formatDate(p.targetEndDate)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
