/**
 * Staff accounts, client invites and one-time account links (WEB_APP_PLAN §10).
 *
 * Pure helpers (validation, form → body mapping, share links, link-state mapping)
 * plus the browser-side API calls, which go through the BFF. Free of server-only
 * imports so Client Components and unit tests can use all of it.
 *
 * Security notes:
 * - Invite / reset tokens only ever appear in a link's path. Nothing here logs them,
 *   and share helpers send the link to WhatsApp / mail apps only on an explicit click.
 * - Workers sign in with a username; their auth account has a hidden internal email
 *   (`…@workers.velanspaces.invalid`) that must never be displayed or searched.
 */

import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/links";
import { formatDateTime } from "@/lib/format";
import { api } from "./client";

// ---------------------------------------------------------------- types (API §10, camelCase)

export type StaffRole = "manager" | "worker";
export const STAFF_ROLES: readonly StaffRole[] = ["manager", "worker"];

export type StaffMember = {
  id: string;
  /** Managers: their login. Workers: null, or a hidden internal address (never show it). */
  email: string | null;
  /** Workers: their login (lower-case). */
  username: string | null;
  role: StaffRole;
  displayName: string | null;
  phone: string | null;
  trade: string | null;
  isSuspended: boolean;
  /** Project ids (not names). Absent on PATCH responses. */
  assignedProjects?: string[];
};

export type CreateStaffBody = {
  role: StaffRole;
  displayName: string;
  email?: string;
  username?: string;
  password: string;
  phone?: string;
  trade?: string;
};

export type UpdateStaffBody = Partial<{
  displayName: string;
  phone: string;
  trade: string;
  isSuspended: boolean;
  username: string;
  email: string;
}>;

export type PasswordResetLink = { resetUrl: string; expiresAt: string };

export type ClientInviteBody = { email: string; displayName: string; phone?: string };

export type ClientInviteResult = {
  alreadyRegistered: boolean;
  inviteUrl: string | null;
  expiresAt: string | null;
};

export type ClientInviteStatus = "valid" | "used" | "expired";

export type ClientInvite = {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  status: ClientInviteStatus;
};

/** `GET /auth/invites/:token`. */
export type InviteLinkDetails = {
  email: string | null;
  displayName: string | null;
  projectName: string | null;
  expiresAt: string | null;
};

/** `GET /auth/password-reset/:token`. `login` is the username, else the email. */
export type ResetLinkDetails = {
  displayName: string | null;
  login: string | null;
  expiresAt: string | null;
};

// ---------------------------------------------------------------- limits (mirror the API DTOs)

export { PASSWORD_MAX, PASSWORD_MIN };
export const NAME_MAX = 120;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 30;
export const TRADE_MAX = 60;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

/** Same rule as the API (`account-links.ts`) and the DB check constraint. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const USERNAME_HINT = "3–32 characters: lower-case letters, numbers, dot, dash or underscore.";

// ---------------------------------------------------------------- usernames & logins

/** What the API stores: trimmed and lower-cased. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** A human message for an invalid username, or null when it's fine (after normalising). */
export function usernameProblem(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u === "") return "Enter a username.";
  if (!/^[a-z0-9._-]+$/.test(u)) return "Use only letters, numbers, dot (.), dash (-) or underscore (_).";
  if (!/^[a-z0-9]/.test(u)) return "Start with a letter or number.";
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return "Use 3–32 characters.";
  return USERNAME_RE.test(u) ? null : "That username isn't allowed.";
}

/**
 * For as-you-type feedback: like `usernameProblem`, but quiet while the only issue is
 * "not long enough yet" (that one is reported when the field is left).
 */
export function liveUsernameProblem(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u === "") return null;
  if (u.length < USERNAME_MIN && /^[a-z0-9][a-z0-9._-]*$/.test(u)) return null;
  return usernameProblem(u);
}

/**
 * True for the non-deliverable auth addresses workers get (`…@workers.velanspaces.invalid`).
 * Any address on the reserved `.invalid` TLD counts, so a configurable domain is covered too.
 */
export function isInternalEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && /\.invalid$/i.test(email.trim());
}

/** An email that is safe to show (never the internal worker address). */
export function visibleEmail(email: string | null | undefined): string | null {
  if (!email || isInternalEmail(email)) return null;
  return email;
}

export type StaffLogin = { kind: "email" | "username"; value: string };

/** What the person types to sign in. Workers: username. Managers: email. */
export function staffLogin(member: Pick<StaffMember, "role" | "email" | "username">): StaffLogin | null {
  const email = visibleEmail(member.email);
  if (member.role === "manager" && email) return { kind: "email", value: email };
  if (member.username) return { kind: "username", value: member.username };
  if (email) return { kind: "email", value: email };
  return null;
}

/** For the reset page: the API's `login` is a username or email; hide internal addresses. */
export function displayLogin(login: string | null | undefined): string | null {
  if (!login || isInternalEmail(login)) return null;
  return login;
}

// ---------------------------------------------------------------- create form

export type StaffFormValues = {
  role: StaffRole;
  displayName: string;
  email: string;
  username: string;
  phone: string;
  trade: string;
  password: string;
};

export function emptyStaffForm(role: StaffRole = "worker"): StaffFormValues {
  return { role, displayName: "", email: "", username: "", phone: "", trade: "", password: "" };
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(NAME_MAX, `Use at most ${NAME_MAX} characters.`);

const emailShape = z.string().email();

/** Adds the role-specific login rule: managers need an email, workers a username. */
function requireLogin(
  ctx: z.RefinementCtx,
  role: StaffRole,
  values: { email?: string; username?: string },
  emailPath: string,
  usernamePath: string,
) {
  if (role === "manager") {
    const email = (values.email ?? "").trim();
    if (email === "") ctx.addIssue({ code: "custom", path: [emailPath], message: "Managers sign in with an email. Enter one." });
    else if (email.length > EMAIL_MAX || !emailShape.safeParse(email).success) {
      ctx.addIssue({ code: "custom", path: [emailPath], message: "Enter a valid email address." });
    }
    return;
  }
  const problem = usernameProblem(values.username ?? "");
  if (problem) ctx.addIssue({ code: "custom", path: [usernamePath], message: problem });
}

export const createStaffSchema = z
  .object({
    role: z.enum(["manager", "worker"]),
    displayName: displayNameSchema,
    email: z.string(),
    username: z.string(),
    phone: z.string().trim().max(PHONE_MAX, `Use at most ${PHONE_MAX} characters.`),
    trade: z.string().trim().max(TRADE_MAX, `Use at most ${TRADE_MAX} characters.`),
    password: passwordSchema,
  })
  .superRefine((v, ctx) => requireLogin(ctx, v.role, v, "email", "username"));

const optional = (value: string) => {
  const t = value.trim();
  return t === "" ? undefined : t;
};

/** Form values → `POST /staff` body. Only the role's own login field is sent. */
export function toCreateStaffBody(values: StaffFormValues): CreateStaffBody {
  const body: CreateStaffBody = {
    role: values.role,
    displayName: values.displayName.trim(),
    password: values.password,
  };
  if (values.role === "manager") {
    body.email = values.email.trim().toLowerCase();
  } else {
    body.username = normalizeUsername(values.username);
    const trade = optional(values.trade);
    if (trade) body.trade = trade;
  }
  const phone = optional(values.phone);
  if (phone) body.phone = phone;
  // Stable key order keeps request bodies predictable (and tests readable).
  return {
    role: body.role,
    displayName: body.displayName,
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.username !== undefined ? { username: body.username } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.trade !== undefined ? { trade: body.trade } : {}),
    password: body.password,
  };
}

// ---------------------------------------------------------------- edit form

export type StaffEditValues = {
  displayName: string;
  phone: string;
  trade: string;
  /** Username (workers) or email (managers). */
  login: string;
  isSuspended: boolean;
};

export function staffEditDefaults(member: StaffMember): StaffEditValues {
  return {
    displayName: member.displayName ?? "",
    phone: member.phone ?? "",
    trade: member.trade ?? "",
    login: member.role === "manager" ? (visibleEmail(member.email) ?? "") : (member.username ?? ""),
    isSuspended: member.isSuspended,
  };
}

export function editStaffSchema(role: StaffRole) {
  return z
    .object({
      displayName: displayNameSchema,
      phone: z.string().trim().max(PHONE_MAX, `Use at most ${PHONE_MAX} characters.`),
      trade: z.string().trim().max(TRADE_MAX, `Use at most ${TRADE_MAX} characters.`),
      login: z.string(),
      isSuspended: z.boolean(),
    })
    .superRefine((v, ctx) => requireLogin(ctx, role, { email: v.login, username: v.login }, "login", "login"));
}

/** Only the fields that changed, normalised the way the API stores them. */
export function staffPatch(member: StaffMember, values: StaffEditValues): UpdateStaffBody {
  const patch: UpdateStaffBody = {};
  const name = values.displayName.trim();
  if (name !== (member.displayName ?? "").trim()) patch.displayName = name;

  const phone = values.phone.trim();
  if (phone !== (member.phone ?? "").trim()) patch.phone = phone;

  if (member.role === "worker") {
    const trade = values.trade.trim();
    if (trade !== (member.trade ?? "").trim()) patch.trade = trade;
    const username = normalizeUsername(values.login);
    if (username !== (member.username ?? "")) patch.username = username;
  } else {
    const email = values.login.trim().toLowerCase();
    if (email !== (visibleEmail(member.email) ?? "").toLowerCase()) patch.email = email;
  }

  if (values.isSuspended !== member.isSuspended) patch.isSuspended = values.isSuspended;
  return patch;
}

/**
 * A staff row as the UI may hold it: internal worker auth emails are dropped (so they
 * never reach React state, the RSC payload or the DOM) and lists are always arrays.
 */
export function sanitizeStaffMember(member: StaffMember): StaffMember {
  return {
    ...member,
    email: visibleEmail(member.email),
    assignedProjects: Array.isArray(member.assignedProjects) ? member.assignedProjects : [],
  };
}

export function sanitizeStaffList(list: unknown): StaffMember[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m): m is StaffMember => !!m && typeof m === "object" && typeof (m as StaffMember).id === "string")
    .map(sanitizeStaffMember);
}

/** PATCH answers without `assignedProjects`; keep what we had. */
export function mergeStaffUpdate(existing: StaffMember, updated: Partial<StaffMember> | null | undefined): StaffMember {
  const merged = { ...existing, ...(updated ?? {}) };
  return { ...merged, email: visibleEmail(merged.email), assignedProjects: updated?.assignedProjects ?? existing.assignedProjects ?? [] };
}

/** Which field a 409 belongs to: the one the API names, else the role's login field. */
export function conflictField(role: StaffRole, message: string | null | undefined): "email" | "username" {
  const m = message ?? "";
  const mentionsEmail = /e-?mail/i.test(m);
  const mentionsUsername = /username/i.test(m);
  if (mentionsUsername && !mentionsEmail) return "username";
  if (mentionsEmail && !mentionsUsername) return "email";
  return role === "worker" ? "username" : "email";
}

// ---------------------------------------------------------------- password generator

// Look-alikes (0/O, 1/l/I) are left out: these passwords get read out over the phone.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "@#$%&*-+=?";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/** Uniform integer in [0, max) from the CSPRNG (rejection sampling, no modulo bias). */
function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

const pick = (alphabet: string) => alphabet[randomIndex(alphabet.length)];

/**
 * A random initial password with at least one lower-case letter, upper-case letter,
 * digit and symbol. Uses `crypto.getRandomValues` only (never Math.random).
 */
export function generatePassword(length = 14): string {
  if (!Number.isInteger(length) || length < PASSWORD_MIN || length > PASSWORD_MAX) {
    throw new RangeError(`Password length must be ${PASSWORD_MIN}–${PASSWORD_MAX}.`);
  }
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates so the guaranteed classes aren't always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---------------------------------------------------------------- sharing

/** WhatsApp "share to anyone" link. The text is encoded; no phone number is attached. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * `mailto:` link. Every part is percent-encoded (spaces as %20, never +), so a crafted
 * address can't add headers like `?bcc=`; only `@` is kept readable for mail apps.
 */
export function mailtoUrl({ to, subject, body }: { to: string; subject: string; body: string }): string {
  const address = encodeURIComponent(to.trim()).replace(/%40/g, "@");
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const greeting = (name: string | null | undefined) => {
  const n = name?.trim();
  return n ? `Hi ${n},` : "Hi,";
};

const expiryPhrase = (expiresAt: string | null | undefined) =>
  expiresAt ? ` and expires on ${formatDateTime(expiresAt)}` : "";

export function inviteMessage({
  name,
  projectName,
  url,
  expiresAt,
}: {
  name: string | null | undefined;
  projectName: string | null | undefined;
  url: string;
  expiresAt: string | null | undefined;
}): string {
  const project = projectName?.trim() ? projectName.trim() : "your project";
  return [
    `${greeting(name)} you're invited to follow ${project} on Velan Spaces.`,
    `Open this link to set your password and see progress, photos and designs:`,
    url,
    `The link works once${expiryPhrase(expiresAt)}.`,
  ].join("\n");
}

export function resetMessage({
  name,
  login,
  url,
  expiresAt,
}: {
  name: string | null | undefined;
  login: string | null | undefined;
  url: string;
  expiresAt: string | null | undefined;
}): string {
  const signIn = displayLogin(login);
  return [
    `${greeting(name)} here is your link to set a new Velan Spaces password:`,
    url,
    `It works once${expiryPhrase(expiresAt)}.${signIn ? ` Then sign in as ${signIn}.` : ""}`,
  ].join("\n");
}

// ---------------------------------------------------------------- account links (invite / reset)

/** API tokens: 32 random bytes, base64url without padding = exactly 43 characters. */
export const LINK_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isLinkToken(token: unknown): token is string {
  return typeof token === "string" && LINK_TOKEN_RE.test(token);
}

export type AccountLinkOutcome =
  | "ok"
  | "invalid"
  | "expired"
  | "used"
  | "account-exists"
  | "validation"
  | "rate-limited"
  | "error";

/** Classifies an invite/reset API answer (404 invalid · 410 used/expired · 409 account exists). */
export function accountLinkOutcome(status: number, message: string | null | undefined): AccountLinkOutcome {
  if (status >= 200 && status < 300) return "ok";
  switch (status) {
    case 404:
      return "invalid";
    case 410:
      return /used/i.test(message ?? "") ? "used" : "expired";
    case 409:
      return "account-exists";
    case 400:
    case 422:
      return "validation";
    case 429:
      return "rate-limited";
    default:
      return "error";
  }
}

/** Dead-end states a link page can show. */
export type LinkState = "invalid" | "expired" | "used" | "error";

export function linkStateFromOutcome(outcome: AccountLinkOutcome): LinkState {
  return outcome === "invalid" || outcome === "expired" || outcome === "used" ? outcome : "error";
}

export function isLinkState(value: unknown): value is LinkState {
  return value === "invalid" || value === "expired" || value === "used" || value === "error";
}

// ---------------------------------------------------------------- client invites

export const clientInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter the client's email.")
    .max(EMAIL_MAX, "That email is too long.")
    .email("Enter a valid email address."),
  displayName: z.string().trim().min(1, "Enter the client's name.").max(NAME_MAX, `Use at most ${NAME_MAX} characters.`),
  phone: z.string().trim().max(PHONE_MAX, `Use at most ${PHONE_MAX} characters.`),
});

export type ClientInviteValues = { email: string; displayName: string; phone: string };

export function toClientInviteBody(values: ClientInviteValues): ClientInviteBody {
  const phone = optional(values.phone);
  return {
    email: values.email.trim().toLowerCase(),
    displayName: values.displayName.trim(),
    ...(phone ? { phone } : {}),
  };
}

export const INVITE_STATUS_LABELS: Record<ClientInviteStatus, string> = {
  valid: "Pending",
  used: "Accepted",
  expired: "Expired",
};

// ---------------------------------------------------------------- list helpers

export type StaffRoleFilter = "all" | StaffRole;
export type StaffFilters = { role: StaffRoleFilter; q: string };

export function filterStaff(list: StaffMember[], { role, q }: StaffFilters): StaffMember[] {
  const needle = q.trim().toLowerCase();
  return list.filter((m) => {
    if (role !== "all" && m.role !== role) return false;
    if (!needle) return true;
    return [m.displayName, m.username, visibleEmail(m.email), m.phone, m.trade].some((field) =>
      (field ?? "").toLowerCase().includes(needle),
    );
  });
}

export function sortStaff(list: StaffMember[]): StaffMember[] {
  return [...list].sort((a, b) =>
    (a.displayName ?? a.username ?? "").localeCompare(b.displayName ?? b.username ?? "", "en", { sensitivity: "base" }),
  );
}

/** Project ids → sorted names; ids the viewer can't resolve are only counted. */
export function assignedProjectNames(
  ids: readonly string[] | undefined,
  nameById: Readonly<Record<string, string>>,
): { names: string[]; unknown: number } {
  const names: string[] = [];
  let unknown = 0;
  for (const id of ids ?? []) {
    const name = nameById[id];
    if (name) names.push(name);
    else unknown += 1;
  }
  names.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  return { names, unknown };
}

// ---------------------------------------------------------------- browser API (via the BFF)

export const STAFF_QUERY_KEY = ["staff"] as const;
export const clientInvitesQueryKey = (projectId: string) => ["projects", projectId, "client-invites"] as const;

const seg = (id: string) => encodeURIComponent(id);

export const accountsApi = {
  listStaff: async () => sanitizeStaffList(await api.get<unknown>("staff")),
  createStaff: async (body: CreateStaffBody) => sanitizeStaffMember(await api.post<StaffMember>("staff", body)),
  updateStaff: (id: string, body: UpdateStaffBody) => api.patch<StaffMember>(`staff/${seg(id)}`, body),
  deleteStaff: (id: string) => api.delete<{ deleted: true }>(`staff/${seg(id)}`),
  createResetLink: (id: string) => api.post<PasswordResetLink>(`staff/${seg(id)}/password-reset-link`),
  listClientInvites: (projectId: string) => api.get<ClientInvite[]>(`projects/${seg(projectId)}/client-invites`),
  inviteClient: (projectId: string, body: ClientInviteBody) =>
    api.post<ClientInviteResult>(`projects/${seg(projectId)}/client-invites`, body),
};
