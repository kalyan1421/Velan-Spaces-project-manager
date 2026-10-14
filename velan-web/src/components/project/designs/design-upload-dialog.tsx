"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { contentApi, contentKeys } from "@/lib/api/project-content";
import { BatchUploadDialog } from "../media/batch-upload-dialog";
import { DESIGN_ACCEPT, DESIGN_EXTENSIONS, MAX_DESIGN_BYTES, formatBytes, validateFiles } from "../media/media";
import { OptionSelect } from "../media/option-select";
import { DESIGN_TYPE_OPTIONS, designTitlesFor, type DesignTypeValue } from "./design-utils";

/** Upload several designs at once: one design record per file. */
export function DesignUploadDialog({
  projectId,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (count: number) => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DesignTypeValue>("2D Plan");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const titleId = useId();
  const titleHintId = useId();

  const rooms = useQuery({
    queryKey: contentKeys.rooms(projectId),
    queryFn: ({ signal }) => contentApi.rooms(projectId, { signal }),
    enabled: open,
  });
  const roomList = rooms.data ?? [];

  return (
    <BatchUploadDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload designs"
      description="Add 2D plans or 3D renders as images or PDFs. Each file becomes its own design."
      target={{ projectId, bucket: "designs", area: "designs" }}
      accept={DESIGN_ACCEPT}
      plan={(_queued, files) =>
        validateFiles(files, { extensions: DESIGN_EXTENSIONS, maxBytes: MAX_DESIGN_BYTES, label: "designs" })
      }
      dropTitle="Drop plans and renders here"
      dropHint={`PDF, JPG, PNG or WebP · up to ${formatBytes(MAX_DESIGN_BYTES)} each`}
      noun="design"
      fields={(disabled) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={title}
              disabled={disabled}
              maxLength={280}
              placeholder="e.g. Ground floor plan"
              aria-describedby={titleHintId}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p id={titleHintId} className="text-xs text-muted-foreground">
              Optional. Leave empty to use each file&apos;s name; several files get “Title (1)”, “Title (2)”…
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionSelect
              label="Type"
              value={type}
              onChange={(v) => v && setType(v as DesignTypeValue)}
              options={DESIGN_TYPE_OPTIONS}
              disabled={disabled}
            />
            <OptionSelect
              label="Room"
              value={roomId}
              onChange={setRoomId}
              options={roomList.map((r) => ({ value: r.id, label: r.name }))}
              noneLabel={roomList.length === 0 ? "No rooms in this project" : "Whole project"}
              disabled={disabled || roomList.length === 0}
            />
          </div>
          <Label className="font-normal text-ink">
            <Switch checked={needsApproval} onCheckedChange={setNeedsApproval} disabled={disabled} />
            Ask the client to approve
          </Label>
        </div>
      )}
      saveItem={async (u, index, all) => {
        const titles = designTitlesFor(
          title,
          all.map((x) => x.item.name),
        );
        const roomName = roomList.find((r) => r.id === roomId)?.name;
        await contentApi.createDesign(projectId, {
          title: titles[index],
          fileUrl: u.ref,
          type,
          ...(roomName ? { roomName } : {}),
          approvalRequired: needsApproval,
        });
      }}
      onSaved={async (count) => {
        setTitle("");
        setRoomId(null);
        setNeedsApproval(false);
        await onSaved(count);
      }}
    />
  );
}
