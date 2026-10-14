/**
 * Project create/edit form: who may set what (mirrors the API rules in
 * projects.service), the zod schema, and the request body builder.
 *
 * API rules (feature/flutter-api-migration):
 *  - head: every member list + budget-access managers (subset of managers) + money.
 *  - manager: only `workerIds`. On create the API makes them a manager with budget
 *    access, so they may enter money; on edit only with budget access on that project.
 *  - A provided member list REPLACES that role's members; omitted lists are kept.
 *  - Money is never rendered or sent for roles that can't see it.
 */

import { z } from "zod";
import { isApiError } from "@/lib/api/errors";
import type { ProjectInput } from "@/lib/api/project-ops";
import type { Project, Role } from "@/lib/api/types";
import { toNumber } from "@/lib/format";

export type FormMode = "create" | "edit";

export type MemberPermissions = {
  managers: boolean;
  workers: boolean;
  budgetAccess: boolean;
  money: boolean;
};

export function memberPermissionsFor(role: Role, { mode, canSeeBudget }: { mode: FormMode; canSeeBudget: boolean }): MemberPermissions {
  if (role === "head") return { managers: true, workers: true, budgetAccess: true, money: true };
  if (role === "manager") {
    return { managers: false, workers: true, budgetAccess: false, money: mode === "create" || canSeeBudget };
  }
  return { managers: false, workers: false, budgetAccess: false, money: false };
}

// ------------------------------------------------------------------ field rules

/** Letters/digits first, then letters, digits and - _ . / # — no spaces. */
export const PROJECT_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/#-]*$/;
export const PROJECT_CODE_MAX = 40;
export const PROJECT_NAME_MAX = 200;
const MONEY_MAX = 999_999_999_999.99; // numeric(14,2)

const PHONE_CHARS = /^\+?[\d\s()-]+$/;

function isPhone(value: string): boolean {
  if (!PHONE_CHARS.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

const emailCheck = z.string().email();

/** "15,00,000" / "₹ 1,250.50" → number; null when not a valid non-negative amount with ≤ 2 decimals. */
export function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[₹,\s]/g, "");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n <= MONEY_MAX ? n : null;
}

const moneyField = z
  .string()
  .trim()
  .refine((v) => parseMoney(v) !== null, "Enter an amount in rupees (up to 2 decimals), e.g. 15,00,000.");

export function projectFormSchema({ money, originalCode }: { money: boolean; originalCode?: string }) {
  const original = originalCode?.trim();
  return z
    .object({
      projectName: z
        .string()
        .trim()
        .min(1, "Enter the project name.")
        .max(PROJECT_NAME_MAX, `Use at most ${PROJECT_NAME_MAX} characters.`),
      projectCode: z
        .string()
        .trim()
        .min(1, "Enter a project code.")
        .max(PROJECT_CODE_MAX, `Use at most ${PROJECT_CODE_MAX} characters.`)
        .refine(
          (code) => code === "" || (original !== undefined && code === original) || PROJECT_CODE_RE.test(code),
          "Use letters, numbers and - _ . / # only (no spaces), starting with a letter or number.",
        ),
      clientName: z.string().trim().max(120, "Use at most 120 characters."),
      clientPhone: z
        .string()
        .trim()
        .refine((v) => v === "" || isPhone(v), "Enter a valid phone number (7–15 digits)."),
      clientEmail: z
        .string()
        .trim()
        .refine((v) => v === "" || emailCheck.safeParse(v).success, "Enter a valid email address."),
      location: z.string().trim().max(200, "Use at most 200 characters."),
      startDate: z.string(),
      targetEndDate: z.string(),
      budget: money ? moneyField : z.string(),
      estimatedCost: money ? moneyField : z.string(),
      managerIds: z.array(z.string()),
      workerIds: z.array(z.string()),
      budgetAccessManagerIds: z.array(z.string()),
      inviteClientNext: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.startDate && v.targetEndDate && v.targetEndDate < v.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetEndDate"],
          message: "The target date can't be before the start date.",
        });
      }
      const managers = new Set(v.managerIds);
      if (v.budgetAccessManagerIds.some((id) => !managers.has(id))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["budgetAccessManagerIds"],
          message: "Budget access can only be given to managers on this project.",
        });
      }
    });
}

export type ProjectFormValues = z.input<ReturnType<typeof projectFormSchema>>;

/** Form field order, used to focus the first invalid field. */
export const PROJECT_FIELD_ORDER: (keyof ProjectFormValues)[] = [
  "projectName",
  "projectCode",
  "location",
  "startDate",
  "targetEndDate",
  "clientName",
  "clientPhone",
  "clientEmail",
  "budget",
  "estimatedCost",
  "managerIds",
  "budgetAccessManagerIds",
  "workerIds",
];

const dateKey = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");
const moneyText = (value: unknown) => (value === undefined || value === null ? "" : String(toNumber(value)));

export function projectFormDefaults(project?: Project): ProjectFormValues {
  return {
    projectName: project?.projectName ?? "",
    projectCode: project?.projectCode ?? "",
    clientName: project?.clientName ?? "",
    clientPhone: project?.clientPhone ?? "",
    clientEmail: project?.clientEmail ?? "",
    location: project?.location ?? "",
    startDate: dateKey(project?.startDate),
    targetEndDate: dateKey(project?.targetEndDate),
    budget: moneyText(project?.budget),
    estimatedCost: moneyText(project?.estimatedCost),
    managerIds: project?.managerIds ?? [],
    workerIds: project?.workerIds ?? [],
    budgetAccessManagerIds: project?.budgetAccessManagerIds ?? [],
    inviteClientNext: false,
  };
}

/**
 * Request body for POST /projects (create) or PATCH /projects/:id (edit).
 * Create omits empty optionals (server defaults); edit sends null to clear them.
 */
export function toProjectPayload(
  values: ProjectFormValues,
  { mode, permissions }: { mode: FormMode; permissions: MemberPermissions },
): ProjectInput {
  const body: ProjectInput = {
    projectName: values.projectName.trim(),
    projectCode: values.projectCode.trim(),
  };
  const optional = (key: "clientName" | "clientPhone" | "clientEmail" | "location" | "startDate" | "targetEndDate") => {
    const v = values[key].trim();
    if (v) body[key] = v;
    else if (mode === "edit") body[key] = null;
  };
  optional("clientName");
  optional("clientPhone");
  optional("clientEmail");
  optional("location");
  optional("startDate");
  optional("targetEndDate");

  if (permissions.money) {
    for (const key of ["budget", "estimatedCost"] as const) {
      const raw = values[key].trim();
      if (raw === "" && mode === "create") continue;
      body[key] = parseMoney(raw) ?? 0;
    }
  }

  if (permissions.managers) body.managerIds = [...new Set(values.managerIds)];
  if (permissions.workers) body.workerIds = [...new Set(values.workerIds)];
  if (permissions.budgetAccess) {
    const managers = new Set(values.managerIds);
    body.budgetAccessManagerIds = [...new Set(values.budgetAccessManagerIds)].filter((id) => managers.has(id));
  }
  return body;
}

/** The delete button stays disabled until the exact project code is typed. */
export function canConfirmDelete(typed: string, projectCode: string): boolean {
  const code = projectCode.trim();
  return code !== "" && typed.trim() === code;
}

export function isDuplicateCodeError(error: unknown): boolean {
  return isApiError(error) && error.status === 409;
}

/** What a project delete removes (FK cascade on the server), for the confirmation dialog. */
export const DELETE_CASCADE = [
  "Site updates, photos and comments",
  "Designs and files",
  "Timeline phases and tasks",
  "Rooms",
  "Budget transactions and settlements",
  "Support chat and complaints",
  "Team and client access to this project",
] as const;
