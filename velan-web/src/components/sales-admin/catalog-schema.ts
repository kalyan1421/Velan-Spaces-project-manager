/** Rate card item form: zod schema, defaults and request body. */

import { z } from "zod";
import {
  CATALOG_ITEM_TYPES,
  SERVICE_UOMS,
  type CatalogItem,
  type CatalogItemInput,
} from "@/lib/api/sales-types";
import { VARIANT_NOUN } from "./catalog-model";

/** Mirrors the API's CreateCatalogItemDto limits. */
export const CATALOG_LIMITS = {
  name: 200,
  description: 2000,
  section: 200,
  variantLabel: 200,
  variants: 50,
  maxRate: 1_000_000_000,
} as const;

const PLAIN_NUMBER = /^\d+(\.\d+)?$/;
const rateFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export type RateResult = { ok: true; value: number } | { ok: false; error: string };

/** "₹1,650", "1650.50", "1,650/-" → 1650 / 1650.5. ₹0 is allowed (e.g. a free option); at most 2 decimals. */
export function parseRate(input: string): RateResult {
  const cleaned = input
    .trim()
    .replace(/^(₹|rs\.?|inr)\s*/i, "")
    .replace(/\s*\/-$/, "")
    .replace(/[,\s]/g, "");
  if (!cleaned) return { ok: false, error: "Enter a rate." };
  if (cleaned.startsWith("-")) return { ok: false, error: "Rate can't be negative." };
  if (!PLAIN_NUMBER.test(cleaned)) return { ok: false, error: "Enter a number, like 1,650 or 1650.50." };
  if ((cleaned.split(".")[1]?.length ?? 0) > 2) return { ok: false, error: "Use at most 2 decimal places." };
  const value = Number(cleaned);
  if (value > CATALOG_LIMITS.maxRate) return { ok: false, error: "That rate is too large." };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/** What a rate input shows for a stored rate: 1,650 / 1,650.5 */
export function formatRateInput(rate: number): string {
  return rateFormat.format(rate);
}

const variantSchema = z.object({
  label: z.string(),
  rate: z.string(),
});

export const catalogItemFormSchema = z
  .object({
    itemType: z.enum(CATALOG_ITEM_TYPES),
    name: z
      .string()
      .trim()
      .min(1, "Enter a name.")
      .max(CATALOG_LIMITS.name, `Keep the name under ${CATALOG_LIMITS.name} characters.`),
    description: z
      .string()
      .trim()
      .max(CATALOG_LIMITS.description, `Keep the description under ${CATALOG_LIMITS.description} characters.`),
    defaultSection: z
      .string()
      .trim()
      .max(CATALOG_LIMITS.section, `Keep the section under ${CATALOG_LIMITS.section} characters.`),
    uom: z.string(),
    active: z.boolean(),
    variants: z.array(variantSchema),
  })
  .superRefine((v, ctx) => {
    const noun = VARIANT_NOUN[v.itemType].toLowerCase();

    if (v.itemType === "service" && !(SERVICE_UOMS as readonly string[]).includes(v.uom)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["uom"], message: "Choose a unit of measure." });
    }

    if (v.variants.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: `Add at least one ${noun} with its rate.` });
    }
    if (v.variants.length > CATALOG_LIMITS.variants) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: `An item can have at most ${CATALOG_LIMITS.variants} ${noun}s.`,
      });
    }

    const seen = new Set<string>();
    v.variants.forEach((variant, i) => {
      const label = variant.label.trim();
      if (!label) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "label"], message: `Name this ${noun}.` });
      } else if (label.length > CATALOG_LIMITS.variantLabel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", i, "label"],
          message: `Keep it under ${CATALOG_LIMITS.variantLabel} characters.`,
        });
      } else {
        const key = label.toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", i, "label"],
            message: `Each ${noun} needs a different name.`,
          });
        }
        seen.add(key);
      }
      const rate = parseRate(variant.rate);
      if (!rate.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "rate"], message: rate.error });
    });
  });

export type CatalogItemFormValues = z.input<typeof catalogItemFormSchema>;

export const EMPTY_VARIANT = { label: "", rate: "" } as const;

export function catalogItemFormDefaults(item?: CatalogItem | null): CatalogItemFormValues {
  if (!item) {
    return {
      itemType: "component",
      name: "",
      description: "",
      defaultSection: "",
      uom: "",
      active: true,
      variants: [{ ...EMPTY_VARIANT }],
    };
  }
  return {
    itemType: item.itemType,
    name: item.name,
    description: item.description ?? "",
    defaultSection: item.defaultSection ?? "",
    uom: item.itemType === "service" ? (item.uom ?? "") : "",
    active: item.active,
    variants:
      item.variants.length > 0
        ? item.variants.map((v) => ({ label: v.label, rate: formatRateInput(v.rate) }))
        : [{ ...EMPTY_VARIANT }],
  };
}

/** A validated form → the POST/PATCH body (the full item; the API stores it as given). */
export function toCatalogItemBody(values: CatalogItemFormValues): Required<CatalogItemInput> {
  return {
    itemType: values.itemType,
    name: values.name.trim(),
    description: values.description.trim(),
    defaultSection: values.defaultSection.trim(),
    uom: values.itemType === "service" ? values.uom : "",
    active: values.active,
    variants: values.variants.map((v) => {
      const rate = parseRate(v.rate);
      return { label: v.label.trim(), rate: rate.ok ? rate.value : 0 };
    }),
  };
}
