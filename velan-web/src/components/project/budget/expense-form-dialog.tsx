"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { useId, useRef, useState, type RefObject } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_SUGGESTIONS,
  PROOF_AREAS,
  formatAmountInput,
  parseAmount,
  todayIST,
  type Expense,
} from "@/lib/api/money";
import { cn } from "@/lib/utils";
import {
  expenseFormDefaults,
  expenseFormSchema,
  expensePayload,
  type ExpenseFormOutput,
  type ExpenseFormValues,
} from "./expense-schema";
import { resolveProofChange } from "./proof";
import { EMPTY_PROOF_DRAFT, ProofField, uploadProof, type ProofDraft } from "./proof-field";
import { useSaveExpense } from "./queries";

const CATEGORY_ITEMS = EXPENSE_CATEGORIES.map((value) => ({ value, label: EXPENSE_CATEGORY_LABELS[value] }));

const TYPE_OPTIONS = [
  { value: "debit", label: "Expense", hint: "Money spent", icon: ArrowUpRight },
  { value: "credit", label: "Income", hint: "Money received", icon: ArrowDownLeft },
] as const;

/** Add or edit an expense / income entry. Closing is blocked while a save or upload runs. */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  projectId,
  expense,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** null = new entry. */
  expense: Expense | null;
  /** Element to focus when the dialog closes (falls back to Base UI's default). */
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
          <DialogTitle>{expense ? "Edit entry" : "Add expense or income"}</DialogTitle>
          <DialogDescription>
            Expenses add to the project&apos;s spend. Income (for example a client payment) is recorded separately.
          </DialogDescription>
        </DialogHeader>
        <ExpenseForm
          key={expense?.id ?? "new"}
          projectId={projectId}
          expense={expense}
          amountRef={amountRef}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({
  projectId,
  expense,
  amountRef,
  onBusyChange,
  onDone,
}: {
  projectId: string;
  expense: Expense | null;
  amountRef: RefObject<HTMLInputElement | null>;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const ids = useId();
  const [today] = useState(() => todayIST());
  const [serverError, setServerError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofDraft>(EMPTY_PROOF_DRAFT);
  const [progress, setProgress] = useState<number | null>(null);
  // Reuse an already-uploaded file if the save failed and the user retries.
  const [uploaded, setUploaded] = useState<{ file: File; ref: string } | null>(null);
  const save = useSaveExpense(projectId);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expenseFormDefaults(expense, today),
  });
  const type = useWatch({ control, name: "type" });
  const date = useWatch({ control, name: "date" });
  const busy = isSubmitting;
  const amount = register("amount");

  const onSubmit = async (values: ExpenseFormOutput) => {
    setServerError(null);
    onBusyChange(true);
    try {
      let uploadedRef: string | null = null;
      if (proof.file) {
        if (uploaded?.file === proof.file) {
          uploadedRef = uploaded.ref;
        } else {
          setProgress(0);
          uploadedRef = await uploadProof({ projectId, area: PROOF_AREAS.expense, file: proof.file, onProgress: setProgress });
          setUploaded({ file: proof.file, ref: uploadedRef });
        }
      }
      const change = resolveProofChange({ hadProof: Boolean(expense?.proofUrl), removed: proof.removed, uploadedRef });
      await save.mutateAsync({ id: expense?.id, body: expensePayload(values, change, expense ? "update" : "create") });
      toast.success(expense ? "Entry updated" : values.type === "credit" ? "Income added" : "Expense added");
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

  const fieldId = (name: string) => `${ids}-${name}`;
  const amountErr = errors.amount?.message;
  const categoryErr = errors.category?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <fieldset className="flex flex-col gap-1.5" disabled={busy}>
        <legend className="mb-1.5 text-sm font-medium text-ink">Type</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-ink has-checked:bg-card has-checked:text-ink has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input type="radio" value={opt.value} className="sr-only" {...register("type")} />
              <opt.icon className="size-4 shrink-0" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fieldId("amount")} label="Amount" error={amountErr} hint="Digits only; commas and ₹ are fine.">
          <InputGroup className="h-9">
            <InputGroupAddon>₹</InputGroupAddon>
            <InputGroupInput
              {...fieldAria(fieldId("amount"), amountErr, "hint")}
              {...amount}
              ref={(el) => {
                amount.ref(el);
                amountRef.current = el;
              }}
              inputMode="decimal"
              autoComplete="off"
              placeholder="15,000"
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
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <Select
                items={CATEGORY_ITEMS}
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                disabled={busy}
              >
                <SelectPrimitive.Label className="text-sm font-medium text-ink">
                  Category {type === "credit" && <span className="font-normal text-muted-foreground">(optional)</span>}
                </SelectPrimitive.Label>
                <SelectTrigger
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className="h-9 w-full"
                  aria-invalid={categoryErr ? true : undefined}
                  aria-describedby={categoryErr ? `${fieldId("category")}-error` : undefined}
                >
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CATEGORY_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {categoryErr && (
                <p id={`${fieldId("category")}-error`} className="text-xs font-medium text-destructive">
                  {categoryErr}
                </p>
              )}
            </div>
          )}
        />

        <FormField id={fieldId("paymentMethod")} label="Payment method" error={errors.paymentMethod?.message}>
          <Input
            className="h-9"
            list={fieldId("methods")}
            autoComplete="off"
            placeholder="Cash, UPI, bank transfer…"
            disabled={busy}
            {...fieldAria(fieldId("paymentMethod"), errors.paymentMethod?.message)}
            {...register("paymentMethod")}
          />
          <datalist id={fieldId("methods")}>
            {PAYMENT_METHOD_SUGGESTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </FormField>
      </div>

      <FormField id={fieldId("accountDetails")} label="Account details / notes" error={errors.accountDetails?.message}>
        <Textarea
          rows={2}
          placeholder="e.g. paid to Ravi Tiles, HDFC ••1234"
          disabled={busy}
          {...fieldAria(fieldId("accountDetails"), errors.accountDetails?.message)}
          {...register("accountDetails")}
        />
      </FormField>

      <ProofField existingUrl={expense?.proofUrl ?? null} draft={proof} onChange={setProof} progress={progress} disabled={busy} />

      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy} className={cn(busy && "min-w-32")}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy
            ? progress !== null
              ? `Uploading ${Math.round(progress * 100)}%`
              : "Saving…"
            : expense
              ? "Save changes"
              : "Add entry"}
        </Button>
      </DialogFooter>
    </form>
  );
}
