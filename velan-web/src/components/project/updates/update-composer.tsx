"use client";

import { Loader2, RotateCcw, Users } from "lucide-react";
import { useId, useState, type Ref } from "react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/app-shell/progress-bar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import { contentApi, type ContentPerson, type ProjectUpdate, type Room } from "@/lib/api/project-content";
import { cn } from "@/lib/utils";
import { filesFromClipboard, namePastedFile } from "../media/dropped-files";
import { MAX_UPDATE_PHOTOS, UPDATE_ACCEPT, planUpdateMedia } from "../media/media";
import { OptionSelect } from "../media/option-select";
import { UploadDropzone } from "../media/upload-dropzone";
import { UploadQueueList, notifyRejected } from "../media/upload-queue-list";
import { useUploadQueue } from "../media/use-upload-queue";
import {
  MAX_UPDATE_TEXT,
  UPDATE_CATEGORIES,
  buildCreateUpdateBody,
  canSubmitUpdate,
  type ComposerValues,
} from "./update-meta";

const EMPTY: ComposerValues = { text: "", category: null, roomId: null, workerIds: [], clientVisible: true };
const CATEGORY_OPTIONS = UPDATE_CATEGORIES.map((c) => ({ value: c, label: c }));

type Stage = "idle" | "uploading" | "saving";

/**
 * Post an update: text, category, room, tagged workers, and several photos
 * (drag-and-drop, paste or picker) or one video. Files upload first with
 * per-file progress; the update is created only when every upload succeeded,
 * so failed files can be retried (or removed) without losing the post.
 */
export function UpdateComposer({
  projectId,
  rooms,
  taggable,
  canSetVisibility,
  onPosted,
  textareaRef,
}: {
  projectId: string;
  rooms: Room[];
  /** Project workers with names; empty hides tagging. */
  taggable: ContentPerson[];
  canSetVisibility: boolean;
  onPosted: (update: ProjectUpdate) => Promise<void> | void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const [values, setValues] = useState<ComposerValues>(EMPTY);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const queue = useUploadQueue({ projectId, bucket: "update-images", area: "updates", compressImages: true });
  const textId = useId();
  const errorId = useId();
  const busy = stage !== "idle";
  const { summary } = queue;

  const set = <K extends keyof ComposerValues>(key: K, value: ComposerValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const addFiles = (files: File[]) => {
    const plan = planUpdateMedia(
      queue.items.map((i) => i.kind),
      files,
    );
    queue.add(plan.accepted);
    notifyRejected(plan.rejected);
    if (plan.accepted.length > 0) setError(null);
  };

  const submit = async () => {
    if (busy) return;
    if (!canSubmitUpdate(values.text, queue.items.length)) {
      setError("Write something or add photos before posting.");
      return;
    }
    setError(null);
    setStage("uploading");
    const uploaded = await queue.upload();
    if (!uploaded) {
      setStage("idle");
      setError("Some files didn't upload. Retry, or remove them and post without them.");
      return;
    }

    setStage("saving");
    try {
      const body = buildCreateUpdateBody(
        values,
        uploaded.map((u) => u.ref),
        uploaded.map((u) => u.item.kind),
        { canSetVisibility },
      );
      const created = await contentApi.createUpdate(projectId, body);
      setValues(EMPTY);
      queue.reset();
      toast.success("Update posted");
      await onPosted(created);
    } catch (e) {
      // Uploaded files keep their refs, so posting again won't re-upload them.
      setError(isApiError(e) ? e.message : "Couldn't post the update. Please try again.");
    } finally {
      setStage("idle");
    }
  };

  const hasVideo = queue.items.some((i) => i.kind === "video");
  const submitLabel =
    stage === "uploading"
      ? `Uploading ${summary.done}/${summary.total}…`
      : stage === "saving"
        ? "Posting…"
        : summary.failed > 0
          ? "Retry and post"
          : "Post update";

  return (
    <form
      aria-label="Post an update"
      noValidate
      className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onPaste={(e) => {
        if (busy) return;
        const files = filesFromClipboard(e.clipboardData);
        if (files.length === 0) return;
        e.preventDefault();
        addFiles(files.map((f, i) => namePastedFile(f, i)));
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={textId} className="text-sm font-medium text-ink">
          Share progress
        </label>
        <Textarea
          id={textId}
          ref={textareaRef}
          rows={3}
          value={values.text}
          maxLength={MAX_UPDATE_TEXT}
          disabled={busy}
          placeholder="What got done today? You can also paste or drop photos here."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => set("text", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OptionSelect
          label="Category"
          value={values.category}
          onChange={(v) => set("category", v)}
          options={CATEGORY_OPTIONS}
          noneLabel="No category"
          disabled={busy}
        />
        <OptionSelect
          label="Room"
          value={values.roomId}
          onChange={(v) => set("roomId", v)}
          options={rooms.map((r) => ({ value: r.id, label: r.name }))}
          noneLabel={rooms.length === 0 ? "No rooms in this project" : "No room"}
          disabled={busy || rooms.length === 0}
        />
      </div>

      {taggable.length > 0 && (
        <fieldset className="flex flex-col gap-1.5" disabled={busy}>
          <legend className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
            Tag workers
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {taggable.map((p) => {
              const on = values.workerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set("workerIds", on ? values.workerIds.filter((id) => id !== p.id) : [...values.workerIds, p.id])
                  }
                  className={cn(
                    "h-7 rounded-full px-3 text-xs font-medium ring-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                    on ? "bg-ink text-white ring-ink" : "bg-background text-ink ring-foreground/15 hover:bg-muted",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <UploadDropzone
        accept={UPDATE_ACCEPT}
        disabled={busy || hasVideo}
        onFiles={addFiles}
        compact
        title={hasVideo ? "Video attached" : "Add photos or a video"}
        hint={
          hasVideo
            ? "An update can have one video. Remove it to add photos instead."
            : `Drag photos (or a folder) here, paste, or choose up to ${MAX_UPDATE_PHOTOS} photos — or one video.`
        }
        buttonLabel="Choose photos or video"
      />

      <UploadQueueList items={queue.items} summary={summary} onRemove={queue.remove} disabled={busy} />

      {stage === "uploading" && summary.total > 0 && (
        <ProgressBar value={summary.progress * 100} label="Overall upload progress" />
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canSetVisibility ? (
          <Label className="font-normal text-ink">
            <Switch
              checked={values.clientVisible}
              onCheckedChange={(checked) => set("clientVisible", checked)}
              disabled={busy}
            />
            Visible to client
          </Label>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {(values.text || queue.items.length > 0) && !busy && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setValues(EMPTY);
                queue.reset();
                setError(null);
              }}
            >
              Clear
            </Button>
          )}
          <Button type="submit" size="lg" disabled={busy} className="min-w-32">
            {busy ? (
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : summary.failed > 0 ? (
              <RotateCcw data-icon="inline-start" aria-hidden />
            ) : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
