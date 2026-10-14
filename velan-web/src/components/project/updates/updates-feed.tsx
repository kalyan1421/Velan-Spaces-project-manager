"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { MessageSquareText, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { ForbiddenState, StateMessage } from "@/components/app-shell/states";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import {
  SIGNED_URL_REFRESH_MS,
  contentApi,
  contentCapabilities,
  contentKeys,
  flattenUpdatePages,
  nextUpdatesOffset,
  type ContentPerson,
  type ProjectUpdate,
  type Room,
} from "@/lib/api/project-content";
import type { Role } from "@/lib/api/types";
import { UpdateCard } from "./update-card";
import { UpdateComposer } from "./update-composer";
import { UpdatesListSkeleton } from "./updates-skeleton";

type Pages = InfiniteData<ProjectUpdate[], number>;

/**
 * Updates tab (staff app and client portal). The API decides what each role
 * receives (clients only get client-visible updates); `variant="portal"`
 * additionally never renders staff controls.
 */
export function UpdatesFeed({
  projectId,
  role,
  variant,
  initialUpdates,
  initialRooms,
  directory,
  projectWorkerIds,
  showHeading = true,
}: {
  projectId: string;
  role: Role;
  variant: "staff" | "portal";
  /** First page from the server; null → fetch in the browser. */
  initialUpdates: ProjectUpdate[] | null;
  initialRooms: Room[];
  /** Worker names (head/manager only); used for tags and labels. */
  directory: ContentPerson[];
  projectWorkerIds: string[];
  /** False when the page already has a visible heading for the feed (portal). */
  showHeading?: boolean;
}) {
  const queryClient = useQueryClient();
  const caps = contentCapabilities(role);
  const staffView = variant === "staff";
  const canPost = staffView && caps.postUpdate;
  const canDelete = staffView && caps.deleteUpdate;
  const canComment = staffView && caps.commentOnUpdate;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const key = contentKeys.updates(projectId);

  const feed = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => contentApi.updatesPage(projectId, pageParam, { signal }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => nextUpdatesOffset(last, all),
    initialData: initialUpdates ? { pages: [initialUpdates], pageParams: [0] } : undefined,
    refetchInterval: SIGNED_URL_REFRESH_MS,
  });

  const rooms = useQuery({
    queryKey: contentKeys.rooms(projectId),
    queryFn: ({ signal }) => contentApi.rooms(projectId, { signal }),
    initialData: initialRooms,
  });

  const updates = useMemo(() => flattenUpdatePages(feed.data?.pages ?? []), [feed.data]);
  const roomsById = useMemo(() => new Map((rooms.data ?? []).map((r) => [r.id, r])), [rooms.data]);
  const people = useMemo(() => new Map(directory.map((p) => [p.id, p])), [directory]);
  const taggable = useMemo(() => {
    const ids = new Set(projectWorkerIds);
    return directory.filter((p) => ids.has(p.id));
  }, [directory, projectWorkerIds]);

  const remove = useMutation({
    mutationFn: (update: ProjectUpdate) => contentApi.deleteUpdate(projectId, update.id),
    onSuccess: async (_data, update) => {
      queryClient.setQueryData<Pages>(key, (data) =>
        data ? { ...data, pages: data.pages.map((p) => p.filter((u) => u.id !== update.id)) } : data,
      );
      toast.success("Update deleted");
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : "Couldn't delete the update."),
  });

  const onDelete = async (update: ProjectUpdate) => {
    try {
      await remove.mutateAsync(update);
      // The card (and its delete button) is gone; keep keyboard users in the feed.
      requestAnimationFrame(() => document.getElementById(`updates-heading-${projectId}`)?.focus());
      return true;
    } catch {
      return false;
    }
  };

  const onAddComment = async (update: ProjectUpdate, text: string) => {
    try {
      const comment = await contentApi.addComment(projectId, update.id, { text });
      queryClient.setQueryData<Pages>(key, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((p) =>
                p.map((u) => (u.id === update.id ? { ...u, comments: [...u.comments, comment] } : u)),
              ),
            }
          : data,
      );
      return true;
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "Couldn't add the comment.");
      return false;
    }
  };

  const forbidden = isApiError(feed.error) && feed.error.status === 403;

  let body: React.ReactNode;
  if (forbidden) {
    body = variant === "portal" ? <ForbiddenState backHref="/portal" backLabel="Back to your projects" /> : <ForbiddenState />;
  } else if (feed.isPending) {
    body = <UpdatesListSkeleton />;
  } else if (feed.isError && updates.length === 0) {
    body = (
      <StateMessage
        icon={TriangleAlert}
        tone="warning"
        title="Updates couldn't load"
        description={isApiError(feed.error) ? feed.error.message : "Please check your connection and try again."}
        action={
          <Button onClick={() => void feed.refetch()}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Try again
          </Button>
        }
      />
    );
  } else if (updates.length === 0) {
    body = (
      <StateMessage
        icon={MessageSquareText}
        title="No updates yet"
        description={
          canPost
            ? "Post the first progress update — photos from site help everyone see where things stand."
            : variant === "portal"
              ? "Your project team will post progress photos and notes here."
              : "Progress posts from the team will appear here."
        }
        action={
          canPost ? (
            <Button variant="outline" onClick={() => composerRef.current?.focus()}>
              Write an update
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <>
        <ol className="flex flex-col gap-4">
          {updates.map((u) => (
            <li key={u.id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 320px" }}>
              <UpdateCard
                update={u}
                roomsById={roomsById}
                directory={people}
                showStaffDetails={staffView}
                canDelete={canDelete}
                canComment={canComment}
                deleting={remove.isPending && remove.variables?.id === u.id}
                onDelete={onDelete}
                onAddComment={onAddComment}
              />
            </li>
          ))}
        </ol>
        {feed.hasNextPage && (
          <div className="flex justify-center">
            <Button variant="outline" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
              {feed.isFetchingNextPage ? "Loading…" : "Load older updates"}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby={`updates-heading-${projectId}`} className="flex flex-col gap-4">
      <h2
        id={`updates-heading-${projectId}`}
        tabIndex={-1}
        className={showHeading ? "font-heading text-lg font-semibold text-ink outline-none" : "sr-only"}
      >
        {variant === "portal" ? "Project updates" : "Updates"}
      </h2>
      {canPost && !forbidden && (
        <UpdateComposer
          projectId={projectId}
          rooms={rooms.data ?? []}
          taggable={taggable}
          canSetVisibility={caps.setUpdateVisibility}
          textareaRef={composerRef}
          onPosted={async () => {
            await queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}
      {body}
    </section>
  );
}
