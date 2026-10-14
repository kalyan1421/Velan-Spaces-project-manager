"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ROOM_NAME_MAX, type Room, type RoomInput } from "@/lib/api/project-ops";
import { validateRoomName } from "./rooms-model";

export type RoomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  rooms: Room[];
  workers: { id: string; name: string }[];
  pending: boolean;
  error: string | null;
  onSubmit: (input: Required<RoomInput>) => void;
};

/** Add or edit a room: name (unique in the project) + workers usually on it. */
export function RoomDialog(props: RoomDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so each opening starts from the room's current values. */}
        {props.open && <RoomForm key={props.room?.id ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function RoomForm({ room, rooms, workers, pending, error, onSubmit }: RoomDialogProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(room?.name ?? "");
  const [assigned, setAssigned] = useState<string[]>(() => {
    const onProject = new Set(workers.map((w) => w.id));
    return (room?.assignedWorkerIds ?? []).filter((w) => onProject.has(w));
  });
  const [nameError, setNameError] = useState<string | undefined>();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateRoomName(name, rooms, room?.id) ?? undefined;
    setNameError(problem);
    if (problem) {
      inputRef.current?.focus();
      return;
    }
    onSubmit({ name: name.trim(), assignedWorkerIds: assigned });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{room ? "Edit room" : "Add room"}</DialogTitle>
        <DialogDescription>Rooms tag timeline tasks and site updates, e.g. “Master bedroom”.</DialogDescription>
      </DialogHeader>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FormField id={nameId} label="Room name" error={nameError}>
        <Input
          ref={inputRef}
          {...fieldAria(nameId, nameError)}
          value={name}
          maxLength={ROOM_NAME_MAX}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      {workers.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">
            Workers on this room <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>
          <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
            {workers.map((w) => (
              <li key={w.id}>
                <label className="flex items-center gap-2.5 text-sm text-ink">
                  <Checkbox
                    checked={assigned.includes(w.id)}
                    onCheckedChange={(checked) =>
                      setAssigned((list) => (checked ? [...list, w.id] : list.filter((x) => x !== w.id)))
                    }
                  />
                  {w.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          {room ? "Save room" : "Add room"}
        </Button>
      </DialogFooter>
    </form>
  );
}
