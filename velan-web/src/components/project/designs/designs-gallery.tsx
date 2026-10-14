"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, PenTool, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import {
  SIGNED_URL_REFRESH_MS,
  contentApi,
  contentCapabilities,
  contentKeys,
  type Design,
} from "@/lib/api/project-content";
import type { Role } from "@/lib/api/types";
import { displayFileName, mediaKindOfUrl } from "../media/media";
import { MediaViewer, type ViewerItem } from "../media/media-viewer";
import { DesignCard } from "./design-card";
import { DesignUploadDialog } from "./design-upload-dialog";
import { designTitle, designTypeLabel, groupDesigns, splitDocuments } from "./design-utils";

const PARAM = "design";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function DesignsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading designs">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Designs tab: grouped grid, full-screen viewer (images + PDFs) and a
 * shareable `?design=<id>` link per design. Staff (head/manager) can upload,
 * toggle "needs client approval" and delete. The portal variant is read-only
 * and leaves quotation PDFs to the Documents section.
 */
export function DesignsGallery({
  projectId,
  role,
  variant,
  initialDesigns,
}: {
  projectId: string;
  role: Role;
  variant: "staff" | "portal";
  initialDesigns: Design[] | null;
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const caps = contentCapabilities(role);
  const staffView = variant === "staff";
  const canUpload = staffView && caps.uploadDesign;
  const canEdit = staffView && caps.editDesign;
  const canDelete = staffView && caps.deleteDesign;
  const key = contentKeys.designs(projectId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Design | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => contentApi.designs(projectId, { signal }),
    initialData: initialDesigns ?? undefined,
    refetchInterval: SIGNED_URL_REFRESH_MS,
  });

  const visible = useMemo(() => {
    const all = query.data ?? [];
    return staffView ? all : splitDocuments(all).designs;
  }, [query.data, staffView]);
  const groups = useMemo(() => groupDesigns(visible), [visible]);
  const ordered = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const viewerItems = useMemo<ViewerItem[]>(
    () =>
      ordered.map((d) => ({
        key: d.id,
        url: d.fileUrl,
        kind: d.fileUrl ? mediaKindOfUrl(d.fileUrl) : "document",
        title: designTitle(d),
        description: [designTypeLabel(d.type), d.roomName].filter(Boolean).join(" · "),
        downloadName: d.fileUrl ? displayFileName(d.fileUrl) : undefined,
      })),
    [ordered],
  );

  const requestedId = searchParams.get(PARAM);
  const openIndex = requestedId ? ordered.findIndex((d) => d.id === requestedId) : -1;
  const missingLink = requestedId !== null && openIndex === -1 && query.data !== undefined;

  const setViewer = (index: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (index === null) params.delete(PARAM);
    else params.set(PARAM, ordered[index].id);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const linkFor = (id: string) => `${window.location.origin}${pathname}?${PARAM}=${encodeURIComponent(id)}`;
  const copyLink = async (id: string) => {
    if (await copyText(linkFor(id))) toast.success("Link copied", { description: "Anyone on this project can open it." });
    else toast.error("Couldn't copy the link. Copy it from the address bar instead.");
  };

  const toggleApproval = useMutation({
    mutationFn: (d: Design) => contentApi.updateDesign(projectId, d.id, { approvalRequired: !d.approvalRequired }),
    onSuccess: async (updated) => {
      toast.success(updated.approvalRequired ? "Client approval requested" : "Approval no longer required");
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Couldn't update the design."),
  });

  const remove = useMutation({
    mutationFn: (d: Design) => contentApi.deleteDesign(projectId, d.id),
    onSuccess: async (_r, d) => {
      setToDelete(null);
      queryClient.setQueryData<Design[]>(key, (list) => list?.filter((x) => x.id !== d.id));
      toast.success("Design deleted");
      requestAnimationFrame(() => document.getElementById(`designs-heading-${projectId}`)?.focus());
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Couldn't delete the design."),
  });

  const forbidden = isApiError(query.error) && query.error.status === 403;

  let body: React.ReactNode;
  if (forbidden) {
    body = variant === "portal" ? <ForbiddenState backHref="/portal" backLabel="Back to your projects" /> : <ForbiddenState />;
  } else if (query.isPending) {
    body = <DesignsGridSkeleton />;
  } else if (query.isError && !query.data) {
    body = (
      <StateMessage
        icon={TriangleAlert}
        tone="warning"
        title="Designs couldn't load"
        description={isApiError(query.error) ? query.error.message : "Please check your connection and try again."}
        action={
          <Button onClick={() => void query.refetch()}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Try again
          </Button>
        }
      />
    );
  } else if (ordered.length === 0) {
    body = (
      <StateMessage
        icon={PenTool}
        title="No designs yet"
        description={
          canUpload
            ? "Upload 2D plans and 3D renders (images or PDFs). You can add several at once."
            : variant === "portal"
              ? "Plans and renders for your home will appear here once the design team shares them."
              : "Plans and renders shared by the design team will appear here."
        }
        action={
          canUpload ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload data-icon="inline-start" aria-hidden />
              Upload designs
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`designs-${projectId}-${g.key}`} className="flex flex-col gap-3">
            <h3 id={`designs-${projectId}-${g.key}`} className="text-sm font-semibold text-ink">
              {g.label} <span className="font-normal text-muted-foreground">({g.items.length})</span>
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((d) => (
                <li key={d.id}>
                  <DesignCard
                    design={d}
                    onOpen={() => setViewer(ordered.indexOf(d))}
                    onCopyLink={() => void copyLink(d.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onToggleApproval={() => toggleApproval.mutate(d)}
                    onDelete={() => setToDelete(d)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section aria-labelledby={`designs-heading-${projectId}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id={`designs-heading-${projectId}`}
          tabIndex={-1}
          className="font-heading text-lg font-semibold text-ink outline-none"
        >
          Designs
          {ordered.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">{ordered.length}</span>}
        </h2>
        {canUpload && ordered.length > 0 && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload data-icon="inline-start" aria-hidden />
            Upload designs
          </Button>
        )}
      </div>

      {missingLink && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>That design link is out of date — the design may have been removed.</span>
            <Button variant="outline" size="sm" onClick={() => setViewer(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {body}

      <MediaViewer
        items={viewerItems}
        index={openIndex >= 0 ? openIndex : null}
        onIndexChange={setViewer}
        label="Design"
        renderActions={(item) => (
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/15 hover:text-white"
            aria-label="Copy link to this design"
            title="Copy link"
            onClick={() => void copyLink(item.key)}
          >
            <Link2 aria-hidden />
          </Button>
        )}
      />

      {canUpload && (
        <DesignUploadDialog
          projectId={projectId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSaved={async (count) => {
            toast.success(`${count} ${count === 1 ? "design" : "designs"} added`);
            await queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}

      {canDelete && (
        <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !remove.isPending && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this design?</AlertDialogTitle>
              <AlertDialogDescription>
                “{toDelete ? designTitle(toDelete) : ""}” and its file will be removed for everyone, including the
                client. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => toDelete && remove.mutate(toDelete)}
              >
                {remove.isPending ? "Deleting…" : "Delete design"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
