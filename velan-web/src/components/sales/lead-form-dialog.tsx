"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { NativeSelect } from "@/components/project/form/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type Lead,
} from "@/lib/api/sales-types";
import {
  LEAD_LIMITS,
  leadFormDefaults,
  leadFormSchema,
  toLeadInput,
  toLeadPatch,
  type LeadFormOutput,
  type LeadFormValues,
} from "./lead-form-schema";
import type { Person } from "./lead-model";
import { useCreateLead, useUpdateLead } from "./use-sales";

/** New lead (lead = null) or edit lead. Closing is blocked while saving. */
export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  people,
  meId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  /** Who a lead can be assigned to (first entry is the current user). */
  people: Person[];
  meId: string;
  onSaved?: (lead: Lead) => void;
}) {
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl" initialFocus={nameRef}>
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            {lead ? "Update the enquiry details." : "Record an enquiry from a call, walk-in, Instagram or a referral."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <LeadForm
            key={lead?.id ?? "new"}
            lead={lead}
            people={people}
            meId={meId}
            nameRef={nameRef}
            onBusyChange={setBusy}
            onDone={(saved) => {
              onOpenChange(false);
              onSaved?.(saved);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeadForm({
  lead,
  people,
  meId,
  nameRef,
  onBusyChange,
  onDone,
}: {
  lead: Lead | null;
  people: Person[];
  meId: string;
  nameRef: RefObject<HTMLInputElement | null>;
  onBusyChange: (busy: boolean) => void;
  onDone: (lead: Lead) => void;
}) {
  const ids = useId();
  const fid = (name: string) => `${ids}-${name}`;
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateLead();
  const update = useUpdateLead(lead?.id ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues, unknown, LeadFormOutput>({
    resolver: zodResolver(leadFormSchema),
    // A new lead is assigned to whoever creates it, like the mobile app.
    defaultValues: leadFormDefaults(lead, { assignedManagerId: meId }),
  });
  const name = register("clientName");
  const busy = isSubmitting;

  // Keep a current assignee the picker doesn't know (e.g. another manager, seen by a manager).
  const options = [...people];
  if (lead?.assignedManagerId && !options.some((p) => p.id === lead.assignedManagerId)) {
    options.push({ id: lead.assignedManagerId, name: lead.assignedManagerName?.trim() || "Current assignee" });
  }

  const onSubmit = async (values: LeadFormOutput) => {
    setServerError(null);
    onBusyChange(true);
    try {
      const saved = lead
        ? await update.mutateAsync(toLeadPatch(values, lead))
        : await create.mutateAsync(toLeadInput(values));
      toast.success(lead ? "Lead updated" : `Lead added for ${values.clientName}`);
      onBusyChange(false);
      onDone(saved.id ? saved : { ...(lead as Lead), ...values });
    } catch (error) {
      onBusyChange(false);
      if (isApiError(error) && error.status === 403) {
        setServerError("You don't have permission to change leads.");
        return;
      }
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  const err = (k: keyof LeadFormValues) => errors[k]?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fid("name")} label="Client name" error={err("clientName")}>
          <Input
            {...fieldAria(fid("name"), err("clientName"))}
            {...name}
            ref={(el) => {
              name.ref(el);
              nameRef.current = el;
            }}
            autoComplete="off"
            maxLength={LEAD_LIMITS.name + 10}
            disabled={busy}
            className="h-9"
          />
        </FormField>
        <FormField id={fid("phone")} label="Phone" error={err("clientPhone")}>
          <Input
            {...fieldAria(fid("phone"), err("clientPhone"))}
            {...register("clientPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="98765 43210"
            disabled={busy}
            className="h-9"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fid("area")} label="Area / location" error={err("area")}>
          <Input {...fieldAria(fid("area"), err("area"))} {...register("area")} placeholder="Adyar, Chennai" disabled={busy} className="h-9" />
        </FormField>
        <FormField id={fid("type")} label="Requirement" error={err("projectType")} hint="e.g. 3BHK full home, kitchen, office">
          <Input
            {...fieldAria(fid("type"), err("projectType"), "hint")}
            {...register("projectType")}
            disabled={busy}
            className="h-9"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={fid("source")} label="Source" error={err("source")}>
          <NativeSelect {...fieldAria(fid("source"), err("source"))} {...register("source")} disabled={busy} className="h-9">
            <option value="">Not recorded</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id={fid("budget")} label="Estimated budget" error={err("estimatedBudget")}>
          <Input
            {...fieldAria(fid("budget"), err("estimatedBudget"))}
            {...register("estimatedBudget")}
            placeholder="10-15 L"
            disabled={busy}
            className="h-9"
          />
        </FormField>
        <FormField id={fid("status")} label="Stage" error={err("status")}>
          <NativeSelect {...fieldAria(fid("status"), err("status"))} {...register("status")} disabled={busy} className="h-9">
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <FormField id={fid("assignee")} label="Assigned to" error={err("assignedManagerId")}>
        <NativeSelect
          {...fieldAria(fid("assignee"), err("assignedManagerId"))}
          {...register("assignedManagerId")}
          disabled={busy}
          className="h-9"
        >
          <option value="">Unassigned</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField id={fid("notes")} label="Notes" error={err("notes")}>
        <Textarea
          {...fieldAria(fid("notes"), err("notes"))}
          {...register("notes")}
          rows={4}
          placeholder="What they asked for, timelines, follow-ups…"
          disabled={busy}
        />
      </FormField>

      <DialogFooter>
        <Button type="submit" size="lg" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Saving…" : lead ? "Save changes" : "Add lead"}
        </Button>
      </DialogFooter>
    </form>
  );
}
