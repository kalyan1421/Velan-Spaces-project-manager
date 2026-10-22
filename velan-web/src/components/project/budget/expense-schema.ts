/** Add/edit expense & income form: zod schema, defaults and request body. */

import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  formatAmountInput,
  isExpenseCategory,
  isValidDateKey,
  parseAmount,
  type Expense,
  type ExpenseBody,
} from "@/lib/api/money";
import { proofBody, type ProofChange } from "./proof";

/** Typed text ("₹15,000", "1500.50") → number, with the parser's messages. */
export const amountField = z.string().transform((value, ctx) => {
  const r = parseAmount(value);
  if (!r.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error });
    return z.NEVER;
  }
  return r.value;
});

export const dateField = z.string().refine(isValidDateKey, "Choose a valid date.");

export const expenseFormSchema = z
  .object({
    type: z.enum(["debit", "credit"]),
    amount: amountField,
    date: dateField,
    category: z.union([z.enum(EXPENSE_CATEGORIES), z.literal("")]),
    paymentMethod: z.string().trim().max(60, "Keep it under 60 characters."),
    accountDetails: z.string().trim().max(1000, "Keep it under 1,000 characters."),
  })
  .superRefine((v, ctx) => {
    if (v.type === "debit" && !v.category) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category"], message: "Choose a category." });
    }
  });

/** What the inputs hold (all strings). */
export type ExpenseFormValues = z.input<typeof expenseFormSchema>;
/** What a valid submit produces (amount parsed). */
export type ExpenseFormOutput = z.output<typeof expenseFormSchema>;

export function expenseFormDefaults(expense: Expense | null, today: string): ExpenseFormValues {
  if (!expense) {
    return { type: "debit", amount: "", date: today, category: "", paymentMethod: "", accountDetails: "" };
  }
  return {
    type: expense.type,
    amount: formatAmountInput(expense.amount),
    date: expense.date || today,
    category: isExpenseCategory(expense.category) ? expense.category : "",
    paymentMethod: expense.paymentMethod,
    accountDetails: expense.accountDetails,
  };
}

/**
 * Request body for `POST/PATCH …/expenses`. Creates omit empty optionals;
 * updates send them as "" so a cleared field is cleared on the server.
 */
export function expensePayload(values: ExpenseFormOutput, proof: ProofChange, mode: "create" | "update"): ExpenseBody {
  const body: ExpenseBody = { type: values.type, amount: values.amount, date: values.date };
  if (values.category) body.category = values.category;
  if (mode === "update") {
    body.paymentMethod = values.paymentMethod;
    body.accountDetails = values.accountDetails;
  } else {
    if (values.paymentMethod) body.paymentMethod = values.paymentMethod;
    if (values.accountDetails) body.accountDetails = values.accountDetails;
  }
  return { ...body, ...proofBody(proof, mode) };
}
