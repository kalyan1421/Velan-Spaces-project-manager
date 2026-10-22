"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { EMPTY_PROOF_DRAFT, ProofField, uploadProof, type ProofDraft } from "@/components/project/budget/proof-field";
import { resolveProofChange } from "@/components/project/budget/proof";
import { useSaveSettlement } from "@/components/project/budget/queries";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import {
  PAYMENT_METHOD_SUGGESTIONS,
  PROOF_AREAS,
  formatAmountInput,
  parseAmount,
  todayIST,
  type Settlement,
} from "@/lib/api/money";
import {
  settlementFormDefaults,
  settlementFormSchema,
  settlementPayload,
  type SettlementFormOutput,
  type SettlementFormValues,
} from "./settlement-schema";

/** Add or edit a settlement (a payment made to a vendor or worker). */
export function SettlementFormDialog({
  open,
  onOpenChange,
  projectId,
  settlement,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  settlement: Settlement | null;
  returnFocus: HTMLElement | null;
}) {
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={(next) => (busy && !next ? undefined : onOpenChange(next))}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        initialFocus={amountRef}
        finalFocus={() => (returnFocus?.isConnected ? returnFocus : true)}
      >
        <DialogHeader>
          <DialogTitle>{settlement ? "Edit settlement" : "Add settlement"}</DialogTitle>
          <DialogDescription>A payment made from this project. It counts towards the project&apos;s spend.</DialogDescription>
        </DialogHeader>
        <SettlementForm
          key={settlement?.id ?? "new"}
          projectId={projectId}
          settlement={settlement}
          amountRef={amountRef}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SettlementForm({
  projectId,
  settlement,
  amountRef,
  onBusyChange,
  onDone,
}: {
  projectId: string;
  settlement: Settlement | null;
  amountRef: RefObject<HTMLInputElement | null>;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const ids = useId();
  const [today] = useState(() => todayIST());
  const [serverError, setServerError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofDraft>(EMPTY_PROOF_DRAFT);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<{ file: File; ref: string } | null>(null);
  const save = useSaveSettlement(projectId);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettlementFormValues, unknown, SettlementFormOutput>({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: settlementFormDefaults(settlement, today),
  });
  const date = useWatch({ control, name: "date" });
  const busy = isSubmitting;
  const amount = register("amount");
  const fieldId = (name: string) => `${ids}-${name}`;

  const onSubmit = async (values: SettlementFormOutput) => {
    setServerError(null);
    onBusyChange(true);
    try {
      let uploadedRef: string | null = null;
      if (proof.file) {
        if (uploaded?.file === proof.file) {
          uploadedRef = uploaded.ref;
        } else {
          setProgress(0);
          uploadedRef = await uploadProof({
            projectId,
            area: PROOF_AREAS.settlement,
            file: proof.file,
            onProgress: setProgress,
          });
          setUploaded({ file: proof.file, ref: uploadedRef });
        }
      }
      const change = resolveProofChange({ hadProof: Boolean(settlement?.proofUrl), removed: proof.removed, uploadedRef });
      await save.mutateAsync({
        id: settlement?.id,
        body: settlementPayload(values, change, settlement ? "update" : "create"),
      });
      toast.success(settlement ? "Settlement updated" : "Settlement added");
      onBusyChange(false);
      onDone();
    } catch (error) {
      onBusyChange(false);
      if (isApiError(error) && error.status === 403) {
        toast.error("You no longer have access to this project's budget.");
        onDone();
        return;
      }
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fieldId("amount")} label="Amount" error={errors.amount?.message} hint="Digits only; commas and ₹ are fine.">
          <InputGroup className="h-9">
            <InputGroupAddon>₹</InputGroupAddon>
            <InputGroupInput
              {...fieldAria(fieldId("amount"), errors.amount?.message, "hint")}
              {...amount}
              ref={(el) => {
                amount.ref(el);
                amountRef.current = el;
              }}
              inputMode="decimal"
              autoComplete="off"
              placeholder="25,000"
              disabled={busy}
              onBlur={(e) => {
                void amount.onBlur(e);
                const r = parseAmount(e.target.value);
                if (r.ok) setValue("amount", formatAmountInput(r.value));
              }}
            />
          </InputGroup>
        </FormField>

        <FormField
          id={fieldId("date")}
          label="Date"
          error={errors.date?.message}
          hint={date > today ? "This date is in the future." : undefined}
        >
          <Input
            type="date"
            className="h-9"
            disabled={busy}
            {...fieldAria(fieldId("date"), errors.date?.message, date > today ? "hint" : undefined)}
            {...register("date")}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fieldId("paidToName")} label="Paid to" error={errors.paidToName?.message}>
          <Input
            className="h-9"
            autoComplete="off"
            placeholder="Vendor or worker name"
            disabled={busy}
            {...fieldAria(fieldId("paidToName"), errors.paidToName?.message)}
            {...register("paidToName")}
          />
        </FormField>

        <FormField id={fieldId("mode")} label="Mode (optional)" error={errors.mode?.message}>
          <Input
            className="h-9"
            list={fieldId("modes")}
            autoComplete="off"
            placeholder="Cash, UPI, bank transfer…"
            disabled={busy}
            {...fieldAria(fieldId("mode"), errors.mode?.message)}
            {...register("mode")}
          />
          <datalist id={fieldId("modes")}>
            {PAYMENT_METHOD_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FormField>
      </div>

      <FormField id={fieldId("description")} label="Description (optional)" error={errors.description?.message}>
        <Textarea
          rows={2}
          placeholder="e.g. Advance for floor tiles"
          disabled={busy}
          {...fieldAria(fieldId("description"), errors.description?.message)}
          {...register("description")}
        />
      </FormField>

      <ProofField
        existingUrl={settlement?.proofUrl ?? null}
        draft={proof}
        onChange={setProof}
        progress={progress}
        disabled={busy}
      />

      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy
            ? progress !== null
              ? `Uploading ${Math.round(progress * 100)}%`
              : "Saving…"
            : settlement
              ? "Save changes"
              : "Add settlement"}
        </Button>
      </DialogFooter>
    </form>
  );
}
