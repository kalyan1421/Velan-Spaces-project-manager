/** Pages under /app/projects/[id] that are not tabs (no tab is highlighted on them). */
export function isProjectEditPath(pathname: string, projectId: string): boolean {
  const base = `/app/projects/${projectId}/edit`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
