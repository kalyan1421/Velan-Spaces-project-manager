"use client";

import { CloudUpload } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filesFromDataTransfer } from "./dropped-files";

/**
 * Drag-and-drop target with a keyboard-operable "Choose files" button
 * (the native picker is the accessible path; dropping is a shortcut).
 * Paste is handled by the surrounding form (`onPaste` + filesFromClipboard).
 */
export function UploadDropzone({
  accept,
  multiple = true,
  disabled = false,
  onFiles,
  title,
  hint,
  buttonLabel = "Choose files",
  compact = false,
  className,
  children,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: ReactNode;
  buttonLabel?: string;
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hintId = useId();

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  return (
    <div
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        void filesFromDataTransfer(e.dataTransfer).then((files) => {
          if (files.length > 0) onFiles(files);
        });
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-muted/30 text-center transition-colors",
        compact ? "px-3 py-4 sm:flex-row sm:justify-between sm:text-left" : "px-4 py-8",
        "data-dragging:border-gold data-dragging:bg-gold/10 data-disabled:opacity-60",
        className,
      )}
    >
      <div className={cn("flex items-center gap-3", compact ? "flex-row" : "flex-col")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-foreground/10">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{dragging ? "Drop to add" : title}</p>
          {hint && (
            <p id={hintId} className="text-xs text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Allow picking the same file again after removing it.
          e.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => inputRef.current?.click()}
        >
          {buttonLabel}
        </Button>
        {children}
      </div>
    </div>
  );
}
