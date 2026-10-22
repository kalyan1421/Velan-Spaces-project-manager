/** Add/edit settlement form: zod schema, defaults and request body. */

import { z } from "zod";
import { formatAmountInput, type Settlement, type SettlementBody } from "@/lib/api/money";
import { amountField, dateField } from "@/components/project/budget/expense-schema";
import { proofBody, type ProofChange } from "@/components/project/budget/proof";

export const settlementFormSchema = z.object({
  amount: amountField,
  date: dateField,
  paidToName: z.string().trim().min(1, "Enter who was paid.").max(200, "Keep it under 200 characters."),
  description: z.string().trim().max(1000, "Keep it under 1,000 characters."),
  mode: z.string().trim().max(60, "Keep it under 60 characters."),
});

export type SettlementFormValues = z.input<typeof settlementFormSchema>;
export type SettlementFormOutput = z.output<typeof settlementFormSchema>;

export function settlementFormDefaults(settlement: Settlement | null, today: string): SettlementFormValues {
  if (!settlement) return { amount: "", date: today, paidToName: "", description: "", mode: "" };
  return {
    amount: formatAmountInput(settlement.amount),
    date: settlement.date || today,
    paidToName: settlement.paidTo,
    description: settlement.description,
    mode: settlement.mode,
  };
}

/** Body for `POST/PATCH …/settlements`; updates send cleared text as "". */
export function settlementPayload(
  values: SettlementFormOutput,
  proof: ProofChange,
  mode: "create" | "update",
): SettlementBody {
  const body: SettlementBody = { amount: values.amount, date: values.date, paidToName: values.paidToName };
  if (mode === "update") {
    body.description = values.description;
    body.mode = values.mode;
  } else {
    if (values.description) body.description = values.description;
    if (values.mode) body.mode = values.mode;
  }
  return { ...body, ...proofBody(proof, mode) };
}
