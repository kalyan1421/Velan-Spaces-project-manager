"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileStack, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { StateMessage } from "@/components/app-shell/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import {
  SIGNED_URL_REFRESH_MS,
  contentKeys,
  type Design,
  type ProjectFile,
} from "@/lib/api/project-content";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { designApi, ensureApprovalDesigns, type ApprovalDesign } from "../designs/design-api";
import { downloadUrl, formatBytes } from "../media/media";
import { ensureSharedFiles, fileApi, type SharedFile } from "./file-api";
import { FileTypeIcon } from "./file-icon";
import { documentRows } from "./file-utils";

const ICON_LINK = buttonVariants({ variant: "outline", size: "icon" });

/**
 * Client "Files & documents" (read-only): attached quotation PDFs (stored as
 * designs of type Quotation) and the project files shared with the client —
 * the API returns only those to a client — each with view and download
 * (R-E1, R-E3). Links are the API's short-lived signed URLs, refreshed in the
 * background.
 */
export function DocumentsList({
  projectId,
  initialDesigns,
  initialFiles,
}: {
  projectId: string;
  initialDesigns: (Design | ApprovalDesign)[] | null;
  initialFiles: (ProjectFile | SharedFile)[] | null;
}) {
  const designs = useQuery({
    queryKey: contentKeys.designs(projectId),
    queryFn: ({ signal }) => designApi.list(projectId, { signal }),
    initialData: initialDesigns ? ensureApprovalDesigns(initialDesigns) : undefined,
    refetchInterval: SIGNED_URL_REFRESH_MS,
    select: ensureApprovalDesigns,
  });
  const files = useQuery({
    queryKey: contentKeys.files(projectId),
    queryFn: ({ signal }) => fileApi.list(projectId, { signal }),
    initialData: initialFiles ? ensureSharedFiles(initialFiles) : undefined,
    refetchInterval: SIGNED_URL_REFRESH_MS,
    select: ensureSharedFiles,
  });

  const rows = useMemo(() => documentRows(designs.data ?? [], files.data ?? []), [designs.data, files.data]);
  const loading = designs.isPending || files.isPending;
  const failed = (designs.isError && !designs.data) || (files.isError && !files.data);
  const error = designs.error ?? files.error;

  let body: React.ReactNode;
  if (loading) {
    body = (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading documents">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (failed && rows.length === 0) {
    body = (
      <StateMessage
        icon={TriangleAlert}
        tone="warning"
        title="Documents couldn't load"
        description={isApiError(error) ? error.message : "Please check your connection and try again."}
        action={
          <Button
            onClick={() => {
              void designs.refetch();
              void files.refetch();
            }}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Try again
          </Button>
        }
      />
    );
  } else if (rows.length === 0) {
    body = (
      <StateMessage
        icon={FileStack}
        title="No documents yet"
        description="Quotations, drawings and documents your project team shares with you will appear here."
      />
    );
  } else {
    body = (
      <ul className="flex flex-col divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 px-3 py-3 sm:px-4">
            <FileTypeIcon name={row.fileName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink" title={row.title}>
                {row.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[row.label, formatDate(row.date), row.size > 0 ? formatBytes(row.size) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {row.url ? (
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ICON_LINK}
                  aria-label={`View ${row.title}`}
                  title="View"
                >
                  <ExternalLink aria-hidden />
                </a>
                <a
                  href={downloadUrl(row.url, row.fileName)}
                  className={cn(ICON_LINK)}
                  aria-label={`Download ${row.title}`}
                  title="Download"
                  download
                >
                  <Download aria-hidden />
                </a>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unavailable</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby={`documents-heading-${projectId}`} className="flex flex-col gap-4">
      <h2 id={`documents-heading-${projectId}`} className="font-heading text-lg font-semibold text-ink">
        Documents
        {rows.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span>}
      </h2>
      {body}
    </section>
  );
}
