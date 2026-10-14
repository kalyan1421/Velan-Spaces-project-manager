"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesWarning } from "@/components/project/form/use-unsaved-changes";
import { isApiError } from "@/lib/api/errors";
import { TIMELINE_LIMITS, projectOps, projectOpsKeys, type TimelinePhase } from "@/lib/api/project-ops";
import { ConflictDialog, DiscardDialog } from "./editor-dialogs";
import { EditorProvider, type EditorContextValue, type Option } from "./editor-context";
import { PhaseEditor } from "./phase-editor";
import {
  createEditorState,
  isDirty,
  phaseFieldId,
  rebaseProgress,
  serializeDraft,
  timelineEditorReducer,
  timelineFingerprint,
  validateDraft,
  type EditorIssue,
} from "./timeline-editor";
import { nextPhaseDates, todayDateKey } from "./timeline-model";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random()}`;

export type TimelineEditorPanelProps = {
  projectId: string;
  projectStart: string | null;
  initialPhases: TimelinePhase[];
  workers: Option[];
  rooms: Option[];
  onClose: () => void;
};

/**
 * Head/manager editor: builds the whole timeline locally and saves it with one
 * PUT. Before saving it re-reads the timeline; if someone else changed it since
 * editing began, the user chooses to reload theirs or save over it (keeping any
 * worker progress on tasks this editor didn't touch — see `rebaseProgress`).
 */
export default function TimelineEditorPanel({ projectId, projectStart, initialPhases, workers, rooms, onClose }: TimelineEditorPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(timelineEditorReducer, initialPhases, createEditorState);
  const [baseline, setBaseline] = useState(initialPhases);
  const [issues, setIssues] = useState<EditorIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<TimelinePhase[] | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pendingFocus = useRef<string | null>(null);
  const dirty = isDirty(state);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (!pendingFocus.current) return;
    const el = document.getElementById(pendingFocus.current);
    pendingFocus.current = null;
    el?.focus();
  });

  const focusAfterRender = useCallback((fieldId: string) => {
    pendingFocus.current = fieldId;
  }, []);

  const errors = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) if (!map.has(issue.fieldId)) map.set(issue.fieldId, issue.message);
    return map;
  }, [issues]);

  const ctx: EditorContextValue = useMemo(
    () => ({
      dispatch,
      errors,
      workers,
      rooms,
      phaseOptions: state.phases.map((p) => ({ key: p.key, name: p.name })),
      announce: setAnnouncement,
      focusAfterRender,
      newKey,
      disabled: saving,
    }),
    [errors, workers, rooms, state.phases, focusAfterRender, saving],
  );

  const addPhase = () => {
    const key = newKey();
    const dates = nextPhaseDates(
      state.phases.map((p) => p.endDate),
      { today: todayDateKey(), projectStart },
    );
    dispatch({ type: "addPhase", key, ...dates });
    setAnnouncement(`Added phase ${state.phases.length + 1}.`);
    focusAfterRender(phaseFieldId(key, "name"));
  };

  const save = async (force: boolean) => {
    const found = validateDraft(state.phases, { workerIds: workers.map((w) => w.id), roomIds: rooms.map((r) => r.id) });
    setIssues(found);
    setSaveError(null);
    if (found.length > 0) {
      // Move focus to the first invalid field; the summary above lists the rest.
      focusAfterRender(found[0].fieldId);
      setAnnouncement(`${found.length} ${found.length === 1 ? "problem" : "problems"} to fix before saving.`);
      return;
    }
    setSaving(true);
    try {
      let draft = state.phases;
      if (!force) {
        const latest = await projectOps.getTimeline(projectId);
        if (timelineFingerprint(latest) !== timelineFingerprint(baseline)) {
          setConflict(latest);
          return;
        }
      } else if (conflict) {
        draft = rebaseProgress(state.phases, baseline, conflict);
      }
      const saved = await projectOps.replaceTimeline(projectId, serializeDraft(draft));
      setConflict(null);
      setBaseline(saved);
      dispatch({ type: "reset", phases: saved });
      queryClient.setQueryData(projectOpsKeys.timeline(projectId), saved);
      void queryClient.invalidateQueries({ queryKey: projectOpsKeys.project(projectId), exact: true });
      router.refresh();
      toast.success("Timeline saved.");
      onClose();
    } catch (error) {
      setSaveError(
        isApiError(error)
          ? error.status === 403
            ? "You don't have permission to change this timeline."
            : error.message
          : "Couldn't save the timeline. Your changes are still here — please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const reloadLatest = () => {
    if (!conflict) return;
    dispatch({ type: "reset", phases: conflict });
    setBaseline(conflict);
    queryClient.setQueryData(projectOpsKeys.timeline(projectId), conflict);
    setConflict(null);
    setIssues([]);
    toast.info("Loaded the latest timeline. Your unsaved changes were discarded.");
  };

  return (
    <EditorProvider value={ctx}>
      <div className="flex flex-col gap-4">
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {issues.length > 0 && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>
              Fix {issues.length} {issues.length === 1 ? "problem" : "problems"} before saving
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
                {issues.slice(0, 8).map((issue, i) => (
                  <li key={`${issue.fieldId}-${i}`}>
                    <a
                      href={`#${issue.fieldId}`}
                      className="underline underline-offset-2"
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(issue.fieldId)?.focus();
                      }}
                    >
                      {issue.message}
                    </a>
                  </li>
                ))}
                {issues.length > 8 && <li>…and {issues.length - 8} more.</li>}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {saveError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        {state.phases.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No phases yet. Add the first phase of the work plan.
          </p>
        ) : (
          <ol aria-label="Timeline phases" className="flex flex-col gap-4">
            {state.phases.map((phase, index) => (
              <PhaseEditor key={phase.key} phase={phase} index={index} count={state.phases.length} />
            ))}
          </ol>
        )}

        <Button
          id="timeline-add-phase"
          type="button"
          variant="outline"
          className="w-fit"
          disabled={saving || state.phases.length >= TIMELINE_LIMITS.phases}
          onClick={addPhase}
        >
          <Plus data-icon="inline-start" />
          Add phase
        </Button>

        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl bg-card/95 p-3 shadow-lg ring-1 ring-foreground/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {saving ? "Saving…" : dirty ? "You have unsaved changes." : "No changes yet."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={saving}
              onClick={() => (dirty ? setConfirmDiscard(true) : onClose())}
            >
              Cancel
            </Button>
            <Button type="button" size="lg" disabled={saving || !dirty} onClick={() => void save(false)}>
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
              {saving ? "Saving…" : "Save timeline"}
            </Button>
          </div>
        </div>
      </div>

      <ConflictDialog
        open={conflict !== null}
        saving={saving}
        onCancel={() => setConflict(null)}
        onReload={reloadLatest}
        onOverwrite={() => void save(true)}
      />
      <DiscardDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onDiscard={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </EditorProvider>
  );
}
