/** New / edit lead form: zod schema, defaults and request bodies. */

import { z } from "zod";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  isLeadStatus,
  type Lead,
  type LeadInput,
  type LeadPatch,
} from "@/lib/api/sales-types";

/** Same limits as the API's lead DTO. */
export const LEAD_LIMITS = {
  name: 120,
  phone: 30,
  area: 200,
  projectType: 60,
  budget: 60,
  notes: 5000,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Indian mobile/landline: digits with optional +, spaces, dashes, brackets; 7–15 digits. */
export function phoneProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^[+\d][\d\s\-()]*$/.test(value)) return "Use digits only (spaces, dashes and a leading + are fine).";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "Enter a valid phone number.";
  return null;
}

const optionalText = (max: number) => z.string().trim().max(max, `Keep it under ${max.toLocaleString("en-IN")} characters.`);

export const leadFormSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(1, "Enter the client's name.")
    .max(LEAD_LIMITS.name, `Keep it under ${LEAD_LIMITS.name} characters.`),
  clientPhone: optionalText(LEAD_LIMITS.phone).superRefine((v, ctx) => {
    const problem = phoneProblem(v);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  }),
  area: optionalText(LEAD_LIMITS.area),
  projectType: optionalText(LEAD_LIMITS.projectType),
  source: z.union([z.enum(LEAD_SOURCES), z.literal("")]),
  estimatedBudget: optionalText(LEAD_LIMITS.budget),
  notes: optionalText(LEAD_LIMITS.notes),
  status: z.enum(LEAD_STATUSES),
  assignedManagerId: z.string().refine((v) => v === "" || UUID.test(v), "Choose someone from the list."),
});

export type LeadFormValues = z.input<typeof leadFormSchema>;
export type LeadFormOutput = z.output<typeof leadFormSchema>;

export function leadFormDefaults(lead: Lead | null, defaults: { assignedManagerId?: string } = {}): LeadFormValues {
  if (!lead) {
    return {
      clientName: "",
      clientPhone: "",
      area: "",
      projectType: "",
      source: "",
      estimatedBudget: "",
      notes: "",
      status: "new",
      assignedManagerId: defaults.assignedManagerId ?? "",
    };
  }
  const source = (LEAD_SOURCES as readonly string[]).includes(lead.source ?? "") ? (lead.source as LeadFormValues["source"]) : "";
  return {
    clientName: lead.clientName ?? "",
    clientPhone: lead.clientPhone ?? "",
    area: lead.area ?? "",
    projectType: lead.projectType ?? "",
    source: lead.source && !source ? "other" : source,
    estimatedBudget: lead.estimatedBudget ?? "",
    notes: lead.notes ?? "",
    status: isLeadStatus(lead.status) ? lead.status : "new",
    assignedManagerId: lead.assignedManagerId ?? "",
  };
}

const orNull = (v: string) => (v === "" ? null : v);

/** `POST /leads`: empty optionals are left out. */
export function toLeadInput(values: LeadFormOutput): LeadInput {
  const body: LeadInput = { clientName: values.clientName, status: values.status };
  if (values.clientPhone) body.clientPhone = values.clientPhone;
  if (values.area) body.area = values.area;
  if (values.projectType) body.projectType = values.projectType;
  if (values.source) body.source = values.source;
  if (values.estimatedBudget) body.estimatedBudget = values.estimatedBudget;
  if (values.notes) body.notes = values.notes;
  if (values.assignedManagerId) body.assignedManagerId = values.assignedManagerId;
  return body;
}

/**
 * `PATCH /leads/:id`: every field is sent (null clears it). A legacy source the
 * form can't represent (shown as "Other") is kept unless the user picks another.
 */
export function toLeadPatch(values: LeadFormOutput, original: Lead): LeadPatch {
  const knownOriginal = (LEAD_SOURCES as readonly string[]).includes(original.source ?? "");
  const keepLegacySource = !knownOriginal && original.source && values.source === "other";
  return {
    clientName: values.clientName,
    clientPhone: orNull(values.clientPhone),
    area: orNull(values.area),
    projectType: orNull(values.projectType),
    source: keepLegacySource ? original.source : orNull(values.source),
    estimatedBudget: orNull(values.estimatedBudget),
    notes: orNull(values.notes),
    status: values.status,
    assignedManagerId: orNull(values.assignedManagerId),
  };
}
