import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accountLinkOutcome,
  assignedProjectNames,
  clientInviteSchema,
  conflictField,
  createStaffSchema,
  displayLogin,
  editStaffSchema,
  emptyStaffForm,
  filterStaff,
  generatePassword,
  inviteMessage,
  isInternalEmail,
  isLinkToken,
  linkStateFromOutcome,
  liveUsernameProblem,
  mailtoUrl,
  mergeStaffUpdate,
  normalizeUsername,
  resetMessage,
  sanitizeStaffList,
  staffEditDefaults,
  staffLogin,
  staffPatch,
  toClientInviteBody,
  toCreateStaffBody,
  usernameProblem,
  whatsappShareUrl,
  type StaffMember,
} from "./accounts";

function member(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "u1",
    email: null,
    username: "ravi.k",
    role: "worker",
    displayName: "Ravi Kumar",
    phone: "9876543210",
    trade: "Carpenter",
    isSuspended: false,
    assignedProjects: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------- usernames

describe("normalizeUsername", () => {
  it("trims and lower-cases", () => {
    expect(normalizeUsername("  Ravi.K ")).toBe("ravi.k");
  });

  it("keeps inner characters as typed (the validator rejects spaces)", () => {
    expect(normalizeUsername("Ravi Kumar")).toBe("ravi kumar");
    expect(usernameProblem("ravi kumar")).not.toBeNull();
  });
});

describe("usernameProblem", () => {
  it("accepts the API's pattern", () => {
    expect(usernameProblem("ravi.k")).toBeNull();
    expect(usernameProblem("r_2-x")).toBeNull();
    expect(usernameProblem("abc")).toBeNull();
    expect(usernameProblem("a".repeat(32))).toBeNull();
  });

  it("validates the normalised value", () => {
    expect(usernameProblem("  RAVI.K ")).toBeNull();
  });

  it("requires a value", () => {
    expect(usernameProblem("")).toMatch(/enter a username/i);
    expect(usernameProblem("   ")).toMatch(/enter a username/i);
  });

  it("rejects too short and too long", () => {
    expect(usernameProblem("ab")).toMatch(/3.32/);
    expect(usernameProblem("a".repeat(33))).toMatch(/3.32/);
  });

  it("must start with a letter or digit", () => {
    expect(usernameProblem("-ravi")).toMatch(/start with a letter or number/i);
    expect(usernameProblem(".ravi")).toMatch(/start with a letter or number/i);
  });

  it("rejects characters outside letters, digits, dot, dash, underscore", () => {
    expect(usernameProblem("ravi@k")).toMatch(/letters, numbers/i);
    expect(usernameProblem("रवि123")).toMatch(/letters, numbers/i);
  });
});

describe("liveUsernameProblem", () => {
  it("stays quiet while a valid start is still too short", () => {
    expect(liveUsernameProblem("")).toBeNull();
    expect(liveUsernameProblem("r")).toBeNull();
    expect(liveUsernameProblem("Ra")).toBeNull();
  });

  it("flags bad characters and starts immediately", () => {
    expect(liveUsernameProblem("r@")).toMatch(/letters, numbers/i);
    expect(liveUsernameProblem("-")).toMatch(/start with a letter or number/i);
  });

  it("flags names that are too long", () => {
    expect(liveUsernameProblem("a".repeat(33))).toMatch(/3.32/);
  });
});

// ---------------------------------------------------------------- internal worker emails

describe("isInternalEmail", () => {
  it("recognises the synthetic worker auth domain", () => {
    expect(isInternalEmail("ravi.k@workers.velanspaces.invalid")).toBe(true);
    expect(isInternalEmail("RAVI@Workers.VelanSpaces.Invalid")).toBe(true);
  });

  it("treats any reserved .invalid address as internal", () => {
    expect(isInternalEmail("x@other.invalid")).toBe(true);
  });

  it("is false for real addresses and empty values", () => {
    expect(isInternalEmail("manager@velanspaces.com")).toBe(false);
    expect(isInternalEmail(null)).toBe(false);
    expect(isInternalEmail(undefined)).toBe(false);
  });
});

describe("staffLogin", () => {
  it("is the username for workers", () => {
    expect(staffLogin(member())).toEqual({ kind: "username", value: "ravi.k" });
  });

  it("is the email for managers", () => {
    expect(staffLogin(member({ role: "manager", email: "asha@velanspaces.com", username: null }))).toEqual({
      kind: "email",
      value: "asha@velanspaces.com",
    });
  });

  it("never returns a worker's internal auth email", () => {
    expect(staffLogin(member({ username: null, email: "ravi@workers.velanspaces.invalid" }))).toBeNull();
  });

  it("falls back to a username when a manager has no email", () => {
    expect(staffLogin(member({ role: "manager", email: null, username: "asha" }))).toEqual({
      kind: "username",
      value: "asha",
    });
  });
});

// ---------------------------------------------------------------- create schema

describe("createStaffSchema", () => {
  const base = { ...emptyStaffForm("worker"), displayName: "Ravi Kumar", password: "s3cret-pass" };
  const errorPaths = (values: unknown) => {
    const result = createStaffSchema.safeParse(values);
    return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
  };

  it("accepts a worker with a username and no email", () => {
    expect(errorPaths({ ...base, role: "worker", username: "Ravi.K" })).toEqual([]);
  });

  it("requires a username for workers", () => {
    expect(errorPaths({ ...base, role: "worker", username: "" })).toEqual(["username"]);
  });

  it("rejects an invalid worker username", () => {
    expect(errorPaths({ ...base, role: "worker", username: "-x" })).toEqual(["username"]);
  });

  it("requires an email for managers, not a username", () => {
    expect(errorPaths({ ...base, role: "manager", username: "", email: "" })).toEqual(["email"]);
    expect(errorPaths({ ...base, role: "manager", username: "", email: "asha@velanspaces.com" })).toEqual([]);
  });

  it("rejects a malformed manager email", () => {
    expect(errorPaths({ ...base, role: "manager", email: "asha@" })).toEqual(["email"]);
  });

  it("requires a display name", () => {
    expect(errorPaths({ ...base, username: "ravi", displayName: "  " })).toEqual(["displayName"]);
  });

  it("enforces 8–72 character passwords", () => {
    expect(errorPaths({ ...base, username: "ravi", password: "short" })).toEqual(["password"]);
    expect(errorPaths({ ...base, username: "ravi", password: "a".repeat(73) })).toEqual(["password"]);
    expect(errorPaths({ ...base, username: "ravi", password: "a".repeat(8) })).toEqual([]);
    expect(errorPaths({ ...base, username: "ravi", password: "a".repeat(72) })).toEqual([]);
  });
});

describe("toCreateStaffBody", () => {
  it("sends a worker's normalised username and never an email", () => {
    const body = toCreateStaffBody({
      ...emptyStaffForm("worker"),
      displayName: " Ravi Kumar ",
      username: " Ravi.K ",
      email: "leftover@example.com",
      phone: " 98765 43210 ",
      trade: " Carpenter ",
      password: "s3cret-pass",
    });
    expect(body).toEqual({
      role: "worker",
      displayName: "Ravi Kumar",
      username: "ravi.k",
      phone: "98765 43210",
      trade: "Carpenter",
      password: "s3cret-pass",
    });
  });

  it("sends a manager's lower-cased email, no username or trade, and omits blanks", () => {
    const body = toCreateStaffBody({
      ...emptyStaffForm("manager"),
      displayName: "Asha",
      email: " Asha@VelanSpaces.com ",
      username: "leftover",
      trade: "leftover",
      password: "s3cret-pass",
    });
    expect(body).toEqual({ role: "manager", displayName: "Asha", email: "asha@velanspaces.com", password: "s3cret-pass" });
  });
});

describe("staffPatch", () => {
  it("only sends fields that changed", () => {
    const m = member();
    expect(
      staffPatch(m, { displayName: "Ravi Kumar", phone: "9876543210", trade: "Mason", login: "ravi.k", isSuspended: false }),
    ).toEqual({ trade: "Mason" });
  });

  it("normalises a changed worker username", () => {
    const m = member();
    expect(
      staffPatch(m, { displayName: "Ravi Kumar", phone: "9876543210", trade: "Carpenter", login: " Ravi.Kumar ", isSuspended: false }),
    ).toEqual({ username: "ravi.kumar" });
  });

  it("sends a manager's changed email lower-cased and never a trade", () => {
    const m = member({ role: "manager", email: "asha@velanspaces.com", username: null, trade: null });
    expect(
      staffPatch(m, { displayName: "Asha", phone: "9876543210", trade: "x", login: "ASHA2@velanspaces.com", isSuspended: true }),
    ).toEqual({ displayName: "Asha", email: "asha2@velanspaces.com", isSuspended: true });
  });

  it("returns an empty patch when nothing changed", () => {
    const m = member();
    expect(
      staffPatch(m, { displayName: "Ravi Kumar", phone: "9876543210", trade: "Carpenter", login: "ravi.k", isSuspended: false }),
    ).toEqual({});
  });
});

describe("conflictField", () => {
  it("uses the API message when it names the field", () => {
    expect(conflictField("manager", "That username is taken")).toBe("username");
    expect(conflictField("worker", "An account with that email already exists")).toBe("email");
  });

  it("falls back to the role's login field", () => {
    expect(conflictField("worker", "Username or email already in use")).toBe("username");
    expect(conflictField("manager", "Username or email already in use")).toBe("email");
    expect(conflictField("manager", null)).toBe("email");
  });
});

// ---------------------------------------------------------------- password generator

describe("generatePassword", () => {
  afterEach(() => vi.restoreAllMocks());

  it("defaults to 14 characters", () => {
    expect(generatePassword()).toHaveLength(14);
  });

  it("honours a requested length within the API's bounds", () => {
    expect(generatePassword(8)).toHaveLength(8);
    expect(generatePassword(72)).toHaveLength(72);
    expect(() => generatePassword(7)).toThrow(RangeError);
    expect(() => generatePassword(73)).toThrow(RangeError);
  });

  it("always contains a lower-case letter, an upper-case letter, a digit and a symbol", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword(8);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("avoids look-alike characters that are hard to read out over the phone", () => {
    for (let i = 0; i < 100; i++) expect(generatePassword(72)).not.toMatch(/[0O1lI]/);
  });

  it("draws its randomness from crypto.getRandomValues", () => {
    const spy = vi.spyOn(globalThis.crypto, "getRandomValues");
    generatePassword();
    expect(spy).toHaveBeenCalled();
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(seen.size).toBe(50);
  });
});

// ---------------------------------------------------------------- share links

describe("whatsappShareUrl", () => {
  it("builds a wa.me link with the encoded message and no phone number", () => {
    expect(whatsappShareUrl("Hi Ravi & team: https://app.example.com/reset-password/abc?x=1#y")).toBe(
      "https://wa.me/?text=Hi%20Ravi%20%26%20team%3A%20https%3A%2F%2Fapp.example.com%2Freset-password%2Fabc%3Fx%3D1%23y",
    );
  });

  it("encodes non-ASCII text and newlines", () => {
    expect(whatsappShareUrl("வணக்கம்\nline")).toBe(`https://wa.me/?text=${encodeURIComponent("வணக்கம்\nline")}`);
  });
});

describe("mailtoUrl", () => {
  it("keeps the @ readable and encodes subject and body with %20, not +", () => {
    expect(mailtoUrl({ to: "asha@velanspaces.com", subject: "Your link", body: "Open: https://x.test/a?b=1&c=2" })).toBe(
      "mailto:asha@velanspaces.com?subject=Your%20link&body=Open%3A%20https%3A%2F%2Fx.test%2Fa%3Fb%3D1%26c%3D2",
    );
  });

  it("can't be used to inject extra headers through the address", () => {
    const url = mailtoUrl({ to: "a@b.com?bcc=evil@x.com", subject: "s", body: "b" });
    expect(url.startsWith("mailto:a@b.com%3Fbcc%3Devil@x.com?subject=")).toBe(true);
  });
});

describe("message builders", () => {
  it("writes a friendly invite message containing the link and expiry", () => {
    const text = inviteMessage({
      name: "Anand",
      projectName: "Lakeview Villa",
      url: "https://app.example.com/invite/tok",
      expiresAt: "2026-10-21T06:30:00Z",
    });
    expect(text).toContain("Hi Anand");
    expect(text).toContain("Lakeview Villa");
    expect(text).toContain("https://app.example.com/invite/tok");
    expect(text).toContain("21 Oct 2026");
  });

  it("writes a reset message with the sign-in name and link", () => {
    const text = resetMessage({
      name: "Ravi",
      login: "ravi.k",
      url: "https://app.example.com/reset-password/tok",
      expiresAt: "2026-10-15T06:30:00Z",
    });
    expect(text).toContain("Hi Ravi");
    expect(text).toContain("ravi.k");
    expect(text).toContain("https://app.example.com/reset-password/tok");
    expect(text).toContain("15 Oct 2026");
  });

  it("copes with missing names", () => {
    expect(inviteMessage({ name: null, projectName: null, url: "u", expiresAt: null })).toMatch(/^Hi,/);
    expect(resetMessage({ name: "", login: null, url: "u", expiresAt: null })).toMatch(/^Hi,/);
  });
});

// ---------------------------------------------------------------- link tokens & states

describe("isLinkToken", () => {
  const good = "A".repeat(20) + "b_c-d" + "9".repeat(18); // 43 chars

  it("accepts 43-character base64url tokens", () => {
    expect(good).toHaveLength(43);
    expect(isLinkToken(good)).toBe(true);
  });

  it("rejects other lengths", () => {
    expect(isLinkToken(good.slice(1))).toBe(false);
    expect(isLinkToken(`${good}A`)).toBe(false);
  });

  it("rejects padding, standard base64 and path tricks", () => {
    expect(isLinkToken(`${good.slice(1)}=`)).toBe(false);
    expect(isLinkToken(`${good.slice(1)}+`)).toBe(false);
    expect(isLinkToken(`${good.slice(1)}/`)).toBe(false);
    expect(isLinkToken(`..${good.slice(2)}`)).toBe(false);
    expect(isLinkToken(`${good.slice(3)}%2F`)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isLinkToken(undefined)).toBe(false);
    expect(isLinkToken(null)).toBe(false);
    expect(isLinkToken(42)).toBe(false);
  });
});

describe("accountLinkOutcome", () => {
  it("maps success", () => {
    expect(accountLinkOutcome(200, null)).toBe("ok");
    expect(accountLinkOutcome(201, null)).toBe("ok");
  });

  it("maps 404 to an invalid link", () => {
    expect(accountLinkOutcome(404, "This link is not valid")).toBe("invalid");
  });

  it("maps 410 to used or expired from the API message", () => {
    expect(accountLinkOutcome(410, "This link has already been used")).toBe("used");
    expect(accountLinkOutcome(410, "This link has expired. Ask for a new one.")).toBe("expired");
    expect(accountLinkOutcome(410, null)).toBe("expired");
  });

  it("maps 409 to an existing account", () => {
    expect(accountLinkOutcome(409, "An account with this email already exists. Sign in instead.")).toBe("account-exists");
  });

  it("maps validation, rate limits and everything else", () => {
    expect(accountLinkOutcome(400, "password must be longer than or equal to 8 characters")).toBe("validation");
    expect(accountLinkOutcome(429, null)).toBe("rate-limited");
    expect(accountLinkOutcome(500, null)).toBe("error");
    expect(accountLinkOutcome(0, null)).toBe("error");
    expect(accountLinkOutcome(503, null)).toBe("error");
  });
});

describe("linkStateFromOutcome", () => {
  it("passes through the dead-end states", () => {
    expect(linkStateFromOutcome("invalid")).toBe("invalid");
    expect(linkStateFromOutcome("expired")).toBe("expired");
    expect(linkStateFromOutcome("used")).toBe("used");
  });

  it("treats anything unexpected on a page load as a temporary error", () => {
    expect(linkStateFromOutcome("validation")).toBe("error");
    expect(linkStateFromOutcome("rate-limited")).toBe("error");
    expect(linkStateFromOutcome("account-exists")).toBe("error");
    expect(linkStateFromOutcome("error")).toBe("error");
  });
});

// ---------------------------------------------------------------- list helpers

describe("filterStaff", () => {
  const list = [
    member({ id: "1", displayName: "Ravi Kumar", username: "ravi.k", trade: "Carpenter" }),
    member({ id: "2", displayName: "Asha Devi", role: "manager", email: "asha@velanspaces.com", username: null, trade: null }),
    member({ id: "3", displayName: "Mohan", username: "mohan", trade: "Electrician", phone: "9000011111" }),
  ];
  const ids = (xs: StaffMember[]) => xs.map((x) => x.id);

  it("filters by role", () => {
    expect(ids(filterStaff(list, { role: "manager", q: "" }))).toEqual(["2"]);
    expect(ids(filterStaff(list, { role: "worker", q: "" }))).toEqual(["1", "3"]);
    expect(ids(filterStaff(list, { role: "all", q: "" }))).toEqual(["1", "2", "3"]);
  });

  it("searches name, login, phone and trade case-insensitively", () => {
    expect(ids(filterStaff(list, { role: "all", q: "ASHA@" }))).toEqual(["2"]);
    expect(ids(filterStaff(list, { role: "all", q: "electric" }))).toEqual(["3"]);
    expect(ids(filterStaff(list, { role: "all", q: "90000" }))).toEqual(["3"]);
    expect(ids(filterStaff(list, { role: "all", q: "ravi.k" }))).toEqual(["1"]);
  });

  it("never matches on a hidden internal email", () => {
    const hidden = [member({ id: "9", username: "x1", email: "x1@workers.velanspaces.invalid" })];
    expect(filterStaff(hidden, { role: "all", q: "velanspaces.invalid" })).toEqual([]);
  });
});

describe("assignedProjectNames", () => {
  it("resolves ids to sorted names and counts unknown ones", () => {
    expect(assignedProjectNames(["p2", "p1", "gone"], { p1: "Lakeview Villa", p2: "Anna Nagar Flat" })).toEqual({
      names: ["Anna Nagar Flat", "Lakeview Villa"],
      unknown: 1,
    });
  });

  it("handles a missing list", () => {
    expect(assignedProjectNames(undefined, {})).toEqual({ names: [], unknown: 0 });
  });
});

// ---------------------------------------------------------------- edit form & client invites

describe("staffEditDefaults + editStaffSchema", () => {
  it("prefills a worker's username and never the internal email", () => {
    const values = staffEditDefaults(member({ email: "ravi.k@workers.velanspaces.invalid" }));
    expect(values.login).toBe("ravi.k");
  });

  it("prefills a manager's email", () => {
    expect(staffEditDefaults(member({ role: "manager", email: "asha@velanspaces.com" })).login).toBe("asha@velanspaces.com");
  });

  it("validates the login by role", () => {
    const ok = { displayName: "A", phone: "", trade: "", isSuspended: false };
    expect(editStaffSchema("worker").safeParse({ ...ok, login: "Ravi.K" }).success).toBe(true);
    expect(editStaffSchema("worker").safeParse({ ...ok, login: "a b" }).success).toBe(false);
    expect(editStaffSchema("manager").safeParse({ ...ok, login: "asha@velanspaces.com" }).success).toBe(true);
    expect(editStaffSchema("manager").safeParse({ ...ok, login: "" }).success).toBe(false);
  });
});

describe("sanitizeStaffList", () => {
  it("drops internal worker emails and fills missing project lists", () => {
    const list = sanitizeStaffList([
      member({ id: "1", email: "ravi.k@workers.velanspaces.invalid", assignedProjects: undefined }),
      member({ id: "2", role: "manager", email: "asha@velanspaces.com", assignedProjects: ["p1"] }),
    ]);
    expect(list.map((m) => m.email)).toEqual([null, "asha@velanspaces.com"]);
    expect(list.map((m) => m.assignedProjects)).toEqual([[], ["p1"]]);
  });

  it("ignores junk", () => {
    expect(sanitizeStaffList(null)).toEqual([]);
    expect(sanitizeStaffList([null, 3, { name: "x" }])).toEqual([]);
  });
});

describe("mergeStaffUpdate", () => {
  it("keeps assigned projects that PATCH responses leave out", () => {
    const merged = mergeStaffUpdate(member({ assignedProjects: ["p1"] }), { displayName: "New", isSuspended: true });
    expect(merged.displayName).toBe("New");
    expect(merged.isSuspended).toBe(true);
    expect(merged.assignedProjects).toEqual(["p1"]);
  });

  it("drops an internal email echoed by the API", () => {
    expect(mergeStaffUpdate(member(), { email: "x@workers.velanspaces.invalid" }).email).toBeNull();
  });
});

describe("displayLogin", () => {
  it("hides internal addresses", () => {
    expect(displayLogin("ravi.k")).toBe("ravi.k");
    expect(displayLogin("asha@velanspaces.com")).toBe("asha@velanspaces.com");
    expect(displayLogin("x@workers.velanspaces.invalid")).toBeNull();
    expect(displayLogin(null)).toBeNull();
  });
});

describe("client invite form", () => {
  it("requires a valid email and a name; phone is optional", () => {
    expect(clientInviteSchema.safeParse({ email: "a@b.co", displayName: "Anand", phone: "" }).success).toBe(true);
    expect(clientInviteSchema.safeParse({ email: "nope", displayName: "Anand", phone: "" }).success).toBe(false);
    expect(clientInviteSchema.safeParse({ email: "a@b.co", displayName: " ", phone: "" }).success).toBe(false);
  });

  it("builds the request body with a lower-cased email and no blank phone", () => {
    expect(toClientInviteBody({ email: " Anand@Mail.com ", displayName: " Anand ", phone: " " })).toEqual({
      email: "anand@mail.com",
      displayName: "Anand",
    });
    expect(toClientInviteBody({ email: "a@b.co", displayName: "A", phone: " 98400 12345 " })).toEqual({
      email: "a@b.co",
      displayName: "A",
      phone: "98400 12345",
    });
  });
});
