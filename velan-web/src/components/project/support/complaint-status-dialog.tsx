"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/project/form/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import {
  RESOLUTION_NOTE_MAX,
  projectOps,
  projectOpsKeys,
  type Complaint,
  type ComplaintPatch,
  type ComplaintStatus,
} from "@/lib/api/project-ops";
import {
  COMPLAINT_STATUS_LABEL,
  complaintNoteRequired,
  nextComplaintStatuses,
  normalizeComplaintStatus,
  validateComplaintUpdate,
} from "./support-model";

/** Head/manager: move a complaint along (open → in progress → resolved/closed) with a resolution note. */
export function ComplaintStatusDialog({
  projectId,
  complaint,
  onOpenChange,
}: {
  projectId: string;
  complaint: Complaint | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={complaint !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {complaint && (
          <StatusForm key={complaint.id} projectId={projectId} complaint={complaint} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusForm({ projectId, complaint, onDone }: { projectId: string; complaint: Complaint; onDone: () => void }) {
  const id = useId();
  const queryClient = useQueryClient();
  const current = normalizeComplaintStatus(complaint.status);
  const [next, setNext] = useState<ComplaintStatus>(nextComplaintStatuses(current)[0] ?? current);
  const [note, setNote] = useState(complaint.resolutionNote ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const noteId = `${id}-note`;
  const noteRequired = complaintNoteRequired(next);

  const update = useMutation({
    mutationFn: (body: ComplaintPatch) => projectOps.updateComplaint(projectId, complaint.id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData<Complaint[]>(projectOpsKeys.complaints(projectId), (list = []) =>
        list.map((c) => (c.id === saved.id ? saved : c)),
      );
      void queryClient.invalidateQueries({ queryKey: projectOpsKeys.complaints(projectId) });
      toast.success(`Complaint marked ${COMPLAINT_STATUS_LABEL[normalizeComplaintStatus(saved.status)].toLowerCase()}.`);
      onDone();
    },
    onError: (error) => setProblem(isApiError(error) ? error.message : "Couldn't update the complaint. Please try again."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const reason = validateComplaintUpdate({ current, next, note, previousNote: complaint.resolutionNote });
    setProblem(reason);
    if (reason) {
      if (noteRequired && !note.trim()) document.getElementById(noteId)?.focus();
      return;
    }
    const body: ComplaintPatch = {};
    if (next !== current) body.status = next;
    if (note.trim() !== (complaint.resolutionNote ?? "").trim()) body.resolutionNote = note.trim();
    update.mutate(body);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Update complaint</DialogTitle>
        <DialogDescription className="break-words">
          {complaint.title || "Untitled complaint"} · currently {COMPLAINT_STATUS_LABEL[current].toLowerCase()}
        </DialogDescription>
      </DialogHeader>
      {problem && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-status`} className="text-sm font-medium text-ink">
          New status
        </label>
        <NativeSelect id={`${id}-status`} value={next} onChange={(e) => setNext(e.target.value as ComplaintStatus)}>
          <option value={current}>{COMPLAINT_STATUS_LABEL[current]} (no change)</option>
          {nextComplaintStatuses(current).map((s) => (
            <option key={s} value={s}>
              {COMPLAINT_STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-sm font-medium text-ink">
          Resolution note {noteRequired ? null : <span className="font-normal text-muted-foreground">(optional)</span>}
        </label>
        <Textarea
          id={noteId}
          rows={4}
          value={note}
          maxLength={RESOLUTION_NOTE_MAX}
          aria-describedby={`${noteId}-hint`}
          onChange={(e) => setNote(e.target.value)}
        />
        <p id={`${noteId}-hint`} className="text-xs text-muted-foreground">
          The client sees this note with the complaint.
        </p>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
