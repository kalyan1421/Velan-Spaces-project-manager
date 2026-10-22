import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Back link + page title for a client-portal project section (mobile-first). */
export function PortalSectionHeader({
  projectId,
  projectName,
  title,
  description,
}: {
  projectId: string;
  projectName: string;
  title: string;
  description?: string;
}) {
  const href = `/portal/projects/${projectId}`;
  return (
    <>
      <SetBreadcrumbs items={[{ label: projectName, href }, { label: title }]} />
      <div className="flex flex-col gap-2">
        <Link href={href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit max-w-full")}>
          <ArrowLeft data-icon="inline-start" aria-hidden />
          <span className="truncate">{projectName}</span>
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
    </>
  );
}
