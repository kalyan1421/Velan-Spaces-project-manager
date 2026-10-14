// Shared by the enquiry form (client) and /api/enquiry (server) so both apply
// exactly the same rules. Relative imports keep it usable from unit tests.

import { z } from "zod";

import { budgetRanges, otherProjectType, services } from "../../content/site";

export const PROJECT_TYPES: readonly string[] = [...services.map((service) => service.title), otherProjectType];

export const BUDGET_RANGES: readonly string[] = budgetRanges;

/**
 * Indian mobile numbers: 10 digits starting 6–9, optionally prefixed with
 * +91 / 91 / 0, with spaces, dashes, dots or brackets anywhere.
 * Returns the normalised "+91XXXXXXXXXX" form, or null if invalid.
 */
export function normalizeIndianMobile(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+91|0091|91|0)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : null;
}

const CONSENT_MESSAGE = "Please agree to the privacy notice so we can contact you";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

const optionalChoice = (choices: readonly string[], message: string) =>
  z
    .string()
    .optional()
    .refine((value) => !value || choices.includes(value), message)
    .transform((value) => (value ? value : undefined));

export const enquirySchema = z.object({
  name: z
    .string({ required_error: "Please enter your name" })
    .trim()
    .min(2, "Please enter your name")
    .max(80, "Please keep your name under 80 characters"),
  phone: z
    .string({ required_error: "Please enter your mobile number" })
    .trim()
    .min(1, "Please enter your mobile number")
    .refine((value) => normalizeIndianMobile(value) !== null, {
      message: "Enter a 10-digit Indian mobile number, with or without +91",
    })
    .transform((value) => normalizeIndianMobile(value) as string),
  email: z
    .string()
    .trim()
    .max(254, "Please check your email address")
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, "Please check your email address")
    .transform((value) => (value ? value.toLowerCase() : undefined)),
  location: optionalText(120, "Please keep the location under 120 characters"),
  projectType: optionalChoice(PROJECT_TYPES, "Please choose a project type from the list"),
  budgetRange: optionalChoice(BUDGET_RANGES, "Please choose a budget range from the list"),
  message: optionalText(1000, "Please keep your message under 1000 characters"),
  /**
   * Honeypot. Real visitors never see or fill it. It is accepted here on
   * purpose and forwarded to the API, which silently drops such enquiries —
   * so bots get a normal "success" and learn nothing.
   */
  company: z.string().max(500).optional(),
  consent: z
    .boolean({
      required_error: CONSENT_MESSAGE,
      invalid_type_error: CONSENT_MESSAGE,
    })
    .refine((value) => value === true, CONSENT_MESSAGE),
});

export type EnquiryFormValues = z.input<typeof enquirySchema>;
export type EnquiryData = z.output<typeof enquirySchema>;

export type EnquiryField = Exclude<keyof EnquiryData, "company">;

/** Body for POST ${API_URL}/public/enquiries (WEB_APP_PLAN.md §4 EnquiryInput). */
export type EnquiryApiPayload = {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  projectType?: string;
  budgetRange?: string;
  message?: string;
  company?: string;
};

/** Builds the API payload with only the keys the API accepts (consent is not sent). */
export function toEnquiryApiPayload(data: EnquiryData): EnquiryApiPayload {
  const payload: EnquiryApiPayload = { name: data.name, phone: data.phone };
  if (data.email) payload.email = data.email;
  if (data.location) payload.location = data.location;
  if (data.projectType) payload.projectType = data.projectType;
  if (data.budgetRange) payload.budgetRange = data.budgetRange;
  if (data.message) payload.message = data.message;
  if (data.company && data.company.trim() !== "") payload.company = data.company;
  return payload;
}

/** Response contract of the Next route handler /api/enquiry. */
export type EnquiryResponse =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<EnquiryField, string>> };

export const TOO_MANY_REQUESTS_MESSAGE = "Too many requests, please try again in a minute.";
export const GENERIC_FAILURE_MESSAGE = "We couldn't send your enquiry right now.";

/** First zod error per field, in a shape the form can apply directly. */
export function fieldErrorsFromZod(error: z.ZodError): Partial<Record<EnquiryField, string>> {
  const out: Partial<Record<EnquiryField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field !== "company" && !(field in out)) {
      out[field as EnquiryField] = issue.message;
    }
  }
  return out;
}

const API_FIELD_KEYS: EnquiryField[] = [
  "name",
  "phone",
  "email",
  "location",
  "projectType",
  "budgetRange",
  "message",
];

/**
 * Maps a NestJS validation error body ({ message: string | string[] }) onto
 * form fields. class-validator messages start with the property name, e.g.
 * "phone must be a valid phone number".
 */
export function fieldErrorsFromApi(body: unknown): {
  fieldErrors: Partial<Record<EnquiryField, string>>;
  unmatched: string[];
} {
  const fieldErrors: Partial<Record<EnquiryField, string>> = {};
  const unmatched: string[] = [];
  const raw = body && typeof body === "object" ? (body as { message?: unknown }).message : undefined;
  const messages = (Array.isArray(raw) ? raw : [raw]).filter((m): m is string => typeof m === "string");

  for (const message of messages) {
    const field = API_FIELD_KEYS.find((key) => message === key || message.startsWith(`${key} `));
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = friendlyApiMessage(field);
    } else if (!field) {
      unmatched.push(message);
    }
  }
  return { fieldErrors, unmatched };
}

function friendlyApiMessage(field: EnquiryField): string {
  switch (field) {
    case "name":
      return "Please check your name";
    case "phone":
      return "Please check your mobile number";
    case "email":
      return "Please check your email address";
    default:
      return "Please check this field";
  }
}
