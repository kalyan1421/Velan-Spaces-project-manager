"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import {
  COMPLAINT_DESCRIPTION_MAX,
  COMPLAINT_TITLE_MAX,
  projectOps,
  projectOpsKeys,
  type Complaint,
} from "@/lib/api/project-ops";
import { PendingAttachments } from "./attachments";
import {
  ATTACHMENT_ACCEPT,
  COMPLAINT_UPLOAD_AREA,
  acceptAttachments,
  complaintFormSchema,
  type ComplaintFormValues,
} from "./support-model";
import { uploadAttachments } from "./upload-attachments";

/** Raise a complaint (clients; staff can log one on a client's behalf). */
export function ComplaintFormDialog({ projectId, staff }: { projectId: string; staff: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus data-icon="inline-start" />
        {staff ? "Log complaint" : "Raise a complaint"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {open && <ComplaintForm projectId={projectId} staff={staff} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ComplaintForm({ projectId, staff, onDone }: { projectId: string; staff: boolean; onDone: () => void }) {
  const id = useId();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintFormSchema),
    defaultValues: { title: "", description: "" },
  });

  const onSubmit = async (values: ComplaintFormValues) => {
    setServerError(null);
    try {
      const refs =
        files.length > 0
          ? await uploadAttachments(projectId, COMPLAINT_UPLOAD_AREA, files, { onProgress: setProgress })
          : [];
      const created = await projectOps.createComplaint(projectId, {
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
        ...(refs.length > 0 ? { attachments: refs } : {}),
      });
      queryClient.setQueryData<Complaint[]>(projectOpsKeys.complaints(projectId), (list = []) => [created, ...list]);
      void queryClient.invalidateQueries({ queryKey: projectOpsKeys.complaints(projectId) });
      toast.success(staff ? "Complaint logged." : "Complaint sent. The team has been notified.");
      onDone();
    } catch (error) {
      setServerError(isApiError(error) ? error.message : error instanceof Error ? error.message : "Couldn't send. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{staff ? "Log a complaint" : "Raise a complaint"}</DialogTitle>
        <DialogDescription>
          {staff
            ? "Record a complaint the client reported by phone or on site."
            : "Tell us what's wrong. The project team is notified and you can follow the status here."}
        </DialogDescription>
      </DialogHeader>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FormField id={titleId} label="Title" error={errors.title?.message}>
        <Input {...fieldAria(titleId, errors.title?.message)} maxLength={COMPLAINT_TITLE_MAX} autoComplete="off" {...register("title")} />
      </FormField>
      <FormField id={descriptionId} label="Details (optional)" error={errors.description?.message}>
        <Textarea
          {...fieldAria(descriptionId, errors.description?.message)}
          rows={4}
          maxLength={COMPLAINT_DESCRIPTION_MAX}
          {...register("description")}
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const result = acceptAttachments(files, Array.from(e.target.files ?? []));
            setFiles(result.files);
            setFileErrors(result.errors);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => fileInput.current?.click()}>
          <Paperclip data-icon="inline-start" />
          Attach photos or PDF
        </Button>
        <PendingAttachments
          files={files}
          disabled={isSubmitting}
          onRemove={(i) => setFiles((list) => list.filter((_, idx) => idx !== i))}
        />
        {fileErrors.length > 0 && (
          <ul role="alert" className="text-xs font-medium text-destructive">
            {fileErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={isSubmitting} />}>Cancel</DialogClose>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
          {isSubmitting
            ? progress !== null && progress < 1
              ? `Uploading… ${Math.round(progress * 100)}%`
              : "Sending…"
            : staff
              ? "Log complaint"
              : "Send complaint"}
        </Button>
      </DialogFooter>
    </form>
  );
}
