import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-shell/shell-skeleton";
import { ForbiddenState } from "@/components/app-shell/states";
import { StaffManager } from "@/components/staff/staff-manager";
import { sanitizeStaffList, type StaffMember } from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <StaffContent />
    </Suspense>
  );
}

/** id → name for the "N projects" popovers. Names are a nicety: a failure here doesn't block the page. */
async function projectNameMap(): Promise<Record<string, string>> {
  try {
    const projects = await getProjects();
    return Object.fromEntries(projects.map((p) => [p.id, p.projectName]));
  } catch (error) {
    if (!isApiError(error)) throw error; // redirects (session refresh) must propagate
    return {};
  }
}

async function StaffContent() {
  const user = await getSession();
  if (!user) return null; // the layout already redirected
  if (user.role !== "head") {
    return <ForbiddenState message="Only the administrator can manage staff accounts." />;
  }

  let staff: StaffMember[];
  let projectNames: Record<string, string>;
  try {
    const [list, names] = await Promise.all([apiFetch<unknown>("staff"), projectNameMap()]);
    // Strips workers' internal auth emails before anything is serialised to the browser.
    staff = sanitizeStaffList(list);
    projectNames = names;
  } catch (error) {
    if (isApiError(error) && error.status === 403) {
      return <ForbiddenState message="Only the administrator can manage staff accounts." />;
    }
    throw error;
  }

  return <StaffManager initialStaff={staff} projectNames={projectNames} currentUserId={user.id} />;
}
