/** Quotation settings form: zod schema, defaults, image changes and the PUT body. */

import { z } from "zod";
import type { QuotationSettings, QuotationSettingsInput } from "@/lib/api/sales-types";

/** Mirrors the API's QuotationSettingsDto limits. */
export const SETTINGS_LIMITS = {
  companyName: 200,
  phone: 40,
  email: 254,
  address: 500,
  footerText: 300,
  defaultTerms: 20000,
  notIncludedItem: 300,
  notIncludedItems: 50,
  prefix: 20,
  projectType: 60,
  minValidity: 1,
  maxValidity: 365,
  maxGst: 100,
} as const;

/** Suggestions only: the project type is free text on quotes. */
export const PROJECT_TYPE_SUGGESTIONS = ["Residential", "Commercial", "Office", "Villa", "Apartment", "Retail"] as const;

const PHONE_RE = /^\+?[\d\s()-]{6,}$/;
/** Same rule as the API: starts with a letter or digit, then letters, digits, "_" or "-". */
const PREFIX_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const max = (n: number, what: string) => `Keep the ${what} under ${n.toLocaleString("en-IN")} characters.`;

export const settingsFormSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(1, "Enter the company name shown on quotes.")
      .max(SETTINGS_LIMITS.companyName, max(SETTINGS_LIMITS.companyName, "name")),
    phone: z
      .string()
      .trim()
      .max(SETTINGS_LIMITS.phone, max(SETTINGS_LIMITS.phone, "phone number"))
      .refine((v) => v === "" || PHONE_RE.test(v), "Enter a valid phone number."),
    email: z
      .string()
      .trim()
      .max(SETTINGS_LIMITS.email, max(SETTINGS_LIMITS.email, "email"))
      .refine((v) => v === "" || EMAIL_RE.test(v), "Enter a valid email address."),
    address: z.string().trim().max(SETTINGS_LIMITS.address, max(SETTINGS_LIMITS.address, "address")),
    footerText: z.string().trim().max(SETTINGS_LIMITS.footerText, max(SETTINGS_LIMITS.footerText, "footer")),
    defaultTerms: z.string().trim().max(SETTINGS_LIMITS.defaultTerms, max(SETTINGS_LIMITS.defaultTerms, "terms")),
    defaultNotIncluded: z.array(z.object({ value: z.string() })),
    quoteValidityDays: z.string().trim(),
    quoteNumberPrefix: z
      .string()
      .trim()
      .min(1, "Enter a prefix, e.g. QUO-.")
      .max(SETTINGS_LIMITS.prefix, `Keep the prefix under ${SETTINGS_LIMITS.prefix} characters.`)
      .refine((v) => v === "" || PREFIX_RE.test(v), "Start with a letter or number; then use letters, numbers, - or _ (no spaces)."),
    defaultProjectType: z
      .string()
      .trim()
      .min(1, "Enter a default project type.")
      .max(SETTINGS_LIMITS.projectType, max(SETTINGS_LIMITS.projectType, "project type")),
    defaultGstPercent: z.string().trim(),
    roundAmounts: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const days = parseValidityDays(v.quoteValidityDays);
    if (!days.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quoteValidityDays"], message: days.error });

    const gst = parseGstPercent(v.defaultGstPercent);
    if (!gst.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["defaultGstPercent"], message: gst.error });

    if (v.defaultNotIncluded.length > SETTINGS_LIMITS.notIncludedItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultNotIncluded"],
        message: `Keep the list to ${SETTINGS_LIMITS.notIncludedItems} items or fewer.`,
      });
    }
    const seen = new Set<string>();
    v.defaultNotIncluded.forEach((item, i) => {
      const text = item.value.trim();
      if (!text) return; // blank rows are dropped on save
      if (text.length > SETTINGS_LIMITS.notIncludedItem) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["defaultNotIncluded", i, "value"],
          message: `Keep it under ${SETTINGS_LIMITS.notIncludedItem} characters.`,
        });
        return;
      }
      const key = text.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["defaultNotIncluded", i, "value"],
          message: "This is already in the list.",
        });
      }
      seen.add(key);
    });
  });

export type SettingsFormValues = z.input<typeof settingsFormSchema>;

type NumberResult = { ok: true; value: number } | { ok: false; error: string };

export function parseValidityDays(input: string): NumberResult {
  const s = input.trim();
  if (!s) return { ok: false, error: "Enter how many days a quote stays valid." };
  if (!/^\d+$/.test(s)) return { ok: false, error: "Enter whole days, like 15." };
  const value = Number(s);
  if (value < SETTINGS_LIMITS.minValidity || value > SETTINGS_LIMITS.maxValidity) {
    return { ok: false, error: `Choose between ${SETTINGS_LIMITS.minValidity} and ${SETTINGS_LIMITS.maxValidity} days.` };
  }
  return { ok: true, value };
}

export function parseGstPercent(input: string): NumberResult {
  const s = input.trim().replace(/%$/, "").trim();
  if (!s) return { ok: false, error: "Enter the GST %, or 0 for none." };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: "Enter a number, like 18." };
  if ((s.split(".")[1]?.length ?? 0) > 2) return { ok: false, error: "Use at most 2 decimal places." };
  const value = Number(s);
  if (value > SETTINGS_LIMITS.maxGst) return { ok: false, error: "GST can't be more than 100%." };
  return { ok: true, value };
}

export function settingsFormDefaults(s: QuotationSettings): SettingsFormValues {
  return {
    companyName: s.companyName,
    phone: s.phone,
    email: s.email,
    address: s.address,
    footerText: s.footerText,
    defaultTerms: s.defaultTerms,
    defaultNotIncluded: s.defaultNotIncluded.map((value) => ({ value })),
    quoteValidityDays: String(s.quoteValidityDays),
    quoteNumberPrefix: s.quoteNumberPrefix,
    defaultProjectType: s.defaultProjectType,
    defaultGstPercent: String(s.defaultGstPercent),
    roundAmounts: s.roundAmounts,
  };
}

// ---------------------------------------------------------------- images

export const IMAGE_KEYS = ["logoUrl", "watermarkLogoUrl", "coverImageUrl"] as const;
export type ImageKey = (typeof IMAGE_KEYS)[number];

/** "QUO-" → "QUO-2026-0001": the API joins prefix, year and a 4-digit sequence without doubling dashes. */
export function quoteNumberExample(prefix: string, year: number): string {
  const p = prefix.trim().replace(/-+$/, "") || "QUO";
  return `${p}-${year}-0001`;
}

/**
 * What the head did to one branding image since the last save. Images upload
 * as soon as they're picked; the settings row only changes on Save.
 */
export type ImageChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; ref: string; previewUrl: string };

export type ImageChanges = Record<ImageKey, ImageChange>;

export const NO_IMAGE_CHANGES: ImageChanges = {
  logoUrl: { kind: "keep" },
  watermarkLogoUrl: { kind: "keep" },
  coverImageUrl: { kind: "keep" },
};

/** Unchanged images are left out: the API holds them as refs, we only hold signed URLs. */
export function imageBody(changes: ImageChanges, current: Pick<QuotationSettings, ImageKey>): QuotationSettingsInput {
  const body: QuotationSettingsInput = {};
  for (const key of IMAGE_KEYS) {
    const change = changes[key];
    if (change.kind === "replace") body[key] = change.ref;
    else if (change.kind === "remove" && current[key]) body[key] = "";
  }
  return body;
}

export function hasImageChanges(changes: ImageChanges, current: Pick<QuotationSettings, ImageKey>): boolean {
  return Object.keys(imageBody(changes, current)).length > 0;
}

/** The image to show for a slot: the new upload's preview, nothing when removed, else the saved one. */
export function displayedImage(change: ImageChange, currentUrl: string): string {
  if (change.kind === "replace") return change.previewUrl;
  if (change.kind === "remove") return "";
  return currentUrl;
}

// ---------------------------------------------------------------- body

/** A validated form (+ image changes) → the PUT body. Blank "not included" rows are dropped. */
export function toSettingsBody(
  values: SettingsFormValues,
  changes: ImageChanges,
  current: Pick<QuotationSettings, ImageKey>,
): QuotationSettingsInput {
  const days = parseValidityDays(values.quoteValidityDays);
  const gst = parseGstPercent(values.defaultGstPercent);
  return {
    companyName: values.companyName.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    address: values.address.trim(),
    footerText: values.footerText.trim(),
    defaultTerms: values.defaultTerms.trim(),
    defaultNotIncluded: values.defaultNotIncluded.map((i) => i.value.trim()).filter(Boolean),
    quoteValidityDays: days.ok ? days.value : 15,
    quoteNumberPrefix: values.quoteNumberPrefix.trim(),
    defaultProjectType: values.defaultProjectType.trim(),
    defaultGstPercent: gst.ok ? gst.value : 0,
    roundAmounts: values.roundAmounts,
    ...imageBody(changes, current),
  };
}

/** Where branding images go: the staff-only `quotations` bucket (`quotation/<...>` paths). */
export const BRANDING_FOLDER = "quotation/branding";
export const BRANDING_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export const BRANDING_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
export const MAX_BRANDING_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateBrandingImage(file: { name: string; size: number }, extension: string): string | null {
  if (!BRANDING_IMAGE_EXTENSIONS.has(extension)) return "Use a PNG, JPG or WebP image.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_BRANDING_IMAGE_BYTES) return "That image is larger than 5 MB.";
  return null;
}
