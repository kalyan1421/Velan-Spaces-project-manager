"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StateMessage } from "@/components/app-shell/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { projectOps, projectOpsKeys, type Room, type RoomInput } from "@/lib/api/project-ops";
import { RoomDialog } from "./room-dialog";
import { sortRooms } from "./rooms-model";

type Editing = { room: Room | null } | null;

const message = (error: unknown, fallback: string) => (isApiError(error) ? error.message : fallback);

export function RoomsManager({
  projectId,
  initialRooms,
  workers,
}: {
  projectId: string;
  initialRooms: Room[];
  /** Workers on the project (rooms may only list these). */
  workers: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const key = projectOpsKeys.rooms(projectId);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: key, queryFn: () => projectOps.listRooms(projectId), initialData: initialRooms });
  const rooms = useMemo(() => sortRooms(data), [data]);
  const names = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers]);

  const save = useMutation({
    mutationFn: ({ room, input }: { room: Room | null; input: Required<RoomInput> }) =>
      room ? projectOps.updateRoom(projectId, room.id, input) : projectOps.createRoom(projectId, input),
    onSuccess: (saved, { room }) => {
      queryClient.setQueryData<Room[]>(key, (list = []) =>
        room ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved],
      );
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success(room ? "Room updated." : `${saved.name} added.`);
      setEditing(null);
    },
    onError: (error) => setFormError(message(error, "Couldn't save the room. Please try again.")),
  });

  const remove = useMutation({
    mutationFn: (room: Room) => projectOps.deleteRoom(projectId, room.id),
    onSuccess: (_res, room) => {
      queryClient.setQueryData<Room[]>(key, (list = []) => list.filter((r) => r.id !== room.id));
      void queryClient.invalidateQueries({ queryKey: key });
      // Tasks that used the room lose their tag server-side.
      void queryClient.invalidateQueries({ queryKey: projectOpsKeys.timeline(projectId) });
      toast.success(`${room.name} deleted.`);
      setDeleting(null);
    },
    onError: (error) => toast.error(message(error, "Couldn't delete the room. Please try again.")),
  });

  const open = (room: Room | null) => {
    setFormError(null);
    setEditing({ room });
  };

  return (
    <section aria-labelledby="rooms-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="rooms-heading" className="font-heading text-lg font-semibold text-ink">
            Rooms
          </h2>
          <p className="text-sm text-muted-foreground">Used to tag timeline tasks and site updates.</p>
        </div>
        <Button size="lg" onClick={() => open(null)}>
          <Plus data-icon="inline-start" />
          Add room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <StateMessage icon={DoorOpen} title="No rooms yet" description="Add the rooms or areas of this project, e.g. Kitchen, Master bedroom." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const assigned = (room.assignedWorkerIds ?? []).flatMap((id) => {
              const name = names.get(id);
              return name ? [{ id, name }] : [];
            });
            return (
              <li key={room.id} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium break-words text-ink">{room.name}</p>
                  <div className="flex shrink-0 gap-0.5">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${room.name}`} onClick={() => open(room)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${room.name}`} onClick={() => setDeleting(room)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                {assigned.length > 0 ? (
                  <ul aria-label={`Workers on ${room.name}`} className="flex flex-wrap gap-1.5">
                    {assigned.map((w) => (
                      <li key={w.id}>
                        <Badge variant="secondary">{w.name}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No workers assigned to this room.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RoomDialog
        open={editing !== null}
        onOpenChange={(next) => (!next ? setEditing(null) : undefined)}
        room={editing?.room ?? null}
        rooms={rooms}
        workers={workers}
        pending={save.isPending}
        error={formError}
        onSubmit={(input) => {
          setFormError(null);
          save.mutate({ room: editing?.room ?? null, input });
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(next) => (!next ? setDeleting(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Timeline tasks and site updates tagged with this room keep their content but lose the room tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep room</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              {remove.isPending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
              Delete room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
