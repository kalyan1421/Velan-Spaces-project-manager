/**
 * Validation for the quote builder. The builder is not a single <form> (nested
 * sections and lines), so it validates the whole draft and shows issues inline;
 * Save and autosave are blocked while any issue remains.
 */

import { z } from "zod";
import { isValidDateKey } from "@/lib/api/money";
import { QUOTE_STATUSES } from "@/lib/api/sales-types";
import { isEmptyLine, splitLines, type QuoteDraft } from "./quote-draft";

/** Mirrors the API's quote DTO / sections parser limits. */
export const QUOTE_LIMITS = {
  name: 200,
  phone: 30,
  email: 254,
  address: 500,
  person: 120,
  enquiryNo: 60,
  siteLocation: 300,
  projectType: 60,
  sectionTitle: 300,
  notIncludedItems: 50,
  notIncludedItem: 300,
  notIncluded: 15000,
  maxPercent: 100,
  maxGst: 100,
  maxMm: 100_000,
  maxQty: 1_000_000,
} as const;

const text = (max: number) => z.string().max(max, `Keep it under ${max.toLocaleString("en-IN")} characters.`);
const optionalDate = z.string().refine((v) => v === "" || isValidDateKey(v), "Choose a valid date.");

export const quoteMetaSchema = z
  .object({
    status: z.enum(QUOTE_STATUSES),
    preparedForName: z
      .string()
      .trim()
      .min(1, "Enter who the quote is prepared for.")
      .max(QUOTE_LIMITS.name, `Keep it under ${QUOTE_LIMITS.name} characters.`),
    preparedForPhone: text(QUOTE_LIMITS.phone),
    preparedForEmail: z
      .string()
      .trim()
      .max(QUOTE_LIMITS.email)
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address."),
    preparedForAddress: text(QUOTE_LIMITS.address),
    handledBy: text(QUOTE_LIMITS.person),
    designedBy: text(QUOTE_LIMITS.person),
    quoteDate: optionalDate,
    validUntil: optionalDate,
    enquiryDate: optionalDate,
    enquiryNo: text(QUOTE_LIMITS.enquiryNo),
    siteLocation: text(QUOTE_LIMITS.siteLocation),
    projectType: z
      .string()
      .trim()
      .min(1, "Enter the project type (e.g. Residential).")
      .max(QUOTE_LIMITS.projectType, `Keep it under ${QUOTE_LIMITS.projectType} characters.`),
    notIncludedText: text(QUOTE_LIMITS.notIncluded).superRefine((v, ctx) => {
      const lines = splitLines(v);
      if (lines.length > QUOTE_LIMITS.notIncludedItems) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `List at most ${QUOTE_LIMITS.notIncludedItems} items.` });
      } else if (lines.some((l) => l.length > QUOTE_LIMITS.notIncludedItem)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Keep each item under ${QUOTE_LIMITS.notIncludedItem} characters.` });
      }
    }),
    discountType: z.enum(["amount", "percent"]),
    discountValue: z.number({ invalid_type_error: "Enter a number." }).finite().min(0, "Discount can't be negative."),
    gstPercent: z
      .number({ invalid_type_error: "Enter a number." })
      .finite()
      .min(0, "GST can't be negative.")
      .max(QUOTE_LIMITS.maxGst, "GST can't be more than 100%."),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === "percent" && v.discountValue > QUOTE_LIMITS.maxPercent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "A percentage can't be more than 100." });
    }
    if (v.quoteDate && v.validUntil && v.validUntil < v.quoteDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validUntil"], message: "Valid until can't be before the quote date." });
    }
  });

/** Field path → first message. Paths: meta field names, `section:<key>`, `line:<key>:<field>`. */
export type QuoteIssues = Record<string, string>;

/**
 * Validates the draft. `subtotal` lets a flat discount be checked against it
 * (a discount larger than the subtotal would make the total negative).
 */
export function quoteDraftIssues(draft: QuoteDraft, subtotal: number): QuoteIssues {
  const issues: QuoteIssues = {};
  const meta = quoteMetaSchema.safeParse(draft);
  if (!meta.success) {
    for (const issue of meta.error.issues) {
      const path = String(issue.path[0] ?? "form");
      issues[path] ??= issue.message;
    }
  }
  if (!issues.discountValue && draft.discountType === "amount" && draft.discountValue > subtotal && draft.discountValue > 0) {
    issues.discountValue = "The discount is larger than the subtotal.";
  }

  for (const section of draft.sections) {
    if (!section.title.trim()) issues[`section:${section.key}`] = "Give this room or section a name.";
    else if (section.title.length > QUOTE_LIMITS.sectionTitle) issues[`section:${section.key}`] = "Keep the name under 300 characters.";

    for (const item of section.items) {
      if (isEmptyLine(item)) continue;
      const at = (field: string) => `line:${item.key}:${field}`;
      if (item.itemType === "component") {
        const bad = (v: number | null) => v === null || !(v > 0) || v > QUOTE_LIMITS.maxMm;
        if (bad(item.lengthMm)) issues[at("lengthMm")] = "Enter the length in mm.";
        if (bad(item.heightMm)) issues[at("heightMm")] = "Enter the height in mm.";
      } else if (item.qty === null || !(item.qty > 0) || item.qty > QUOTE_LIMITS.maxQty) {
        issues[at("qty")] = "Enter a quantity.";
      }
    }
  }
  return issues;
}

export function issueCount(issues: QuoteIssues): number {
  return Object.keys(issues).length;
}
