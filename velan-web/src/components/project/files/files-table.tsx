"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FolderOpen, RotateCcw, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isApiError } from "@/lib/api/errors";
import {
  SIGNED_URL_REFRESH_MS,
  contentApi,
  contentCapabilities,
  contentKeys,
  type ProjectFile,
} from "@/lib/api/project-content";
import type { Role } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BatchUploadDialog } from "../media/batch-upload-dialog";
import { FILE_ACCEPT, FILE_EXTENSIONS, MAX_FILE_BYTES, downloadUrl, fileTypeLabel, formatBytes, validateFiles } from "../media/media";
import { FileTypeIcon } from "./file-icon";
import { buildCreateFileBody, fileDisplayName, fileNameWithExtension, sortFilesNewestFirst } from "./file-utils";

const ICON_LINK = cn(buttonVariants({ variant: "ghost", size: "icon-sm" }));

export function FilesTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-busy="true" aria-label="Loading files">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Files tab: table with open/download; head/manager upload and delete. */
export function FilesTable({
  projectId,
  role,
  initialFiles,
}: {
  projectId: string;
  role: Role;
  initialFiles: ProjectFile[] | null;
}) {
  const queryClient = useQueryClient();
  const caps = contentCapabilities(role);
  const key = contentKeys.files(projectId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectFile | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => contentApi.files(projectId, { signal }),
    initialData: initialFiles ?? undefined,
    refetchInterval: SIGNED_URL_REFRESH_MS,
  });
  const files = useMemo(() => sortFilesNewestFirst(query.data ?? []), [query.data]);

  const remove = useMutation({
    mutationFn: (f: ProjectFile) => contentApi.deleteFile(projectId, f.id),
    onSuccess: async (_r, f) => {
      setToDelete(null);
      queryClient.setQueryData<ProjectFile[]>(key, (list) => list?.filter((x) => x.id !== f.id));
      toast.success("File deleted");
      requestAnimationFrame(() => document.getElementById(`files-heading-${projectId}`)?.focus());
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : "Couldn't delete the file."),
  });

  const forbidden = isApiError(query.error) && query.error.status === 403;
  const uploadButton = (
    <Button onClick={() => setUploadOpen(true)}>
      <Upload data-icon="inline-start" aria-hidden />
      Upload files
    </Button>
  );

  let body: React.ReactNode;
  if (forbidden) {
    body = <ForbiddenState />;
  } else if (query.isPending) {
    body = <FilesTableSkeleton />;
  } else if (query.isError && !query.data) {
    body = (
      <StateMessage
        icon={TriangleAlert}
        tone="warning"
        title="Files couldn't load"
        description={isApiError(query.error) ? query.error.message : "Please check your connection and try again."}
        action={
          <Button onClick={() => void query.refetch()}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Try again
          </Button>
        }
      />
    );
  } else if (files.length === 0) {
    body = (
      <StateMessage
        icon={FolderOpen}
        title="No files yet"
        description={
          caps.uploadFile
            ? "Keep contracts, bills, specs and site documents with the project. You can upload several at once."
            : "Documents shared on this project will appear here."
        }
        action={caps.uploadFile ? uploadButton : undefined}
      />
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Size</TableHead>
              <TableHead className="hidden lg:table-cell">Uploaded by</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => {
              const name = fileDisplayName(f);
              const fileName = fileNameWithExtension(f);
              return (
                <TableRow key={f.id}>
                  <TableCell className="max-w-0 min-w-48 whitespace-normal">
                    <div className="flex items-center gap-3">
                      <FileTypeIcon name={fileName} />
                      <div className="min-w-0">
                        {f.storagePath ? (
                          <a
                            href={f.storagePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 font-medium break-words text-ink underline-offset-4 hover:underline"
                          >
                            {name}
                          </a>
                        ) : (
                          <span className="line-clamp-2 font-medium break-words text-ink">{name}</span>
                        )}
                        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                          <span className="md:hidden">{fileTypeLabel(fileName)}</span>
                          <span className="sm:hidden">· {formatDate(f.uploadedAt)}</span>
                          {f.version > 1 && <Badge variant="outline">v{f.version}</Badge>}
                          {f.roomName && <span>{f.roomName}</span>}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{fileTypeLabel(fileName)}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {f.size > 0 ? formatBytes(f.size) : "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{f.uploadedByName ?? "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    <time dateTime={f.uploadedAt} title={formatDateTime(f.uploadedAt)}>
                      {formatDate(f.uploadedAt)}
                    </time>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      {f.storagePath && (
                        <>
                          <a
                            href={f.storagePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(ICON_LINK, "hidden sm:inline-flex")}
                            aria-label={`Open ${name}`}
                            title="Open"
                          >
                            <ExternalLink aria-hidden />
                          </a>
                          <a
                            href={downloadUrl(f.storagePath, fileName)}
                            className={ICON_LINK}
                            aria-label={`Download ${name}`}
                            title="Download"
                            download
                          >
                            <Download aria-hidden />
                          </a>
                        </>
                      )}
                      {caps.deleteFile && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${name}`}
                          title="Delete"
                          onClick={() => setToDelete(f)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <section aria-labelledby={`files-heading-${projectId}`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`files-heading-${projectId}`} tabIndex={-1} className="font-heading text-lg font-semibold text-ink outline-none">
          Files
          {files.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">{files.length}</span>}
        </h2>
        {caps.uploadFile && files.length > 0 && uploadButton}
      </div>
      {body}

      {caps.uploadFile && (
        <BatchUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          title="Upload files"
          description="Contracts, bills, specs, spreadsheets, photos or videos. Each file is added separately."
          target={{ projectId, bucket: "project-files", area: "files" }}
          accept={FILE_ACCEPT}
          plan={(_queued, picked) =>
            validateFiles(picked, { extensions: FILE_EXTENSIONS, maxBytes: MAX_FILE_BYTES, label: "project files" })
          }
          dropTitle="Drop files here"
          dropHint={`PDF, Office, text, CSV, images or video · up to ${formatBytes(MAX_FILE_BYTES)} each`}
          noun="file"
          saveItem={async (u) => {
            await contentApi.createFile(projectId, buildCreateFileBody(u.item.file, u.ref));
          }}
          onSaved={async (count) => {
            toast.success(`${count} ${count === 1 ? "file" : "files"} uploaded`);
            await queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}

      {caps.deleteFile && (
        <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !remove.isPending && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this file?</AlertDialogTitle>
              <AlertDialogDescription>
                “{toDelete ? fileDisplayName(toDelete) : ""}” will be removed from the project for everyone. This
                can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
              <Button variant="destructive" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete)}>
                {remove.isPending ? "Deleting…" : "Delete file"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
