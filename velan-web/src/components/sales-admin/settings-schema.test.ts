import { describe, expect, it } from "vitest";
import { DEFAULT_QUOTATION_SETTINGS, type QuotationSettings } from "@/lib/api/sales-types";
import {
  NO_IMAGE_CHANGES,
  displayedImage,
  hasImageChanges,
  imageBody,
  parseGstPercent,
  parseValidityDays,
  quoteNumberExample,
  settingsFormDefaults,
  settingsFormSchema,
  toSettingsBody,
  validateBrandingImage,
  type SettingsFormValues,
} from "./settings-schema";

const saved: QuotationSettings = {
  ...DEFAULT_QUOTATION_SETTINGS,
  companyName: "Velan Spaces",
  logoUrl: "https://storage.example/sign/quotations/quotation/branding/logo.png?token=abc",
  defaultNotIncluded: ["Loose furniture", "Civil work"],
  defaultGstPercent: 18,
};

const values = (over: Partial<SettingsFormValues> = {}): SettingsFormValues => ({ ...settingsFormDefaults(saved), ...over });

const issues = (v: SettingsFormValues) => {
  const r = settingsFormSchema.safeParse(v);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("settingsFormSchema", () => {
  it("accepts the saved settings", () => {
    expect(issues(values())).toEqual({});
  });

  it("requires a company name, prefix and project type", () => {
    const e = issues(values({ companyName: " ", quoteNumberPrefix: "", defaultProjectType: "" }));
    expect(e.companyName).toMatch(/company name/);
    expect(e.quoteNumberPrefix).toMatch(/prefix/);
    expect(e.defaultProjectType).toMatch(/project type/);
  });

  it("checks email, phone and prefix formats", () => {
    const e = issues(values({ email: "nope", phone: "abc", quoteNumberPrefix: "QUO 1" }));
    expect(e.email).toBe("Enter a valid email address.");
    expect(e.phone).toBe("Enter a valid phone number.");
    expect(e.quoteNumberPrefix).toMatch(/no spaces/);
    expect(issues(values({ email: "", phone: "" }))).toEqual({});
    expect(issues(values({ phone: "+91 98400 12345", quoteNumberPrefix: "VS_Q-" }))).toEqual({});
    expect(issues(values({ quoteNumberPrefix: "-QUO" })).quoteNumberPrefix).toMatch(/Start with a letter/);
    expect(issues(values({ quoteNumberPrefix: "VS/Q" })).quoteNumberPrefix).toBeDefined();
  });

  it("validates validity days and GST", () => {
    expect(issues(values({ quoteValidityDays: "0" })).quoteValidityDays).toMatch(/between 1 and 365/);
    expect(issues(values({ quoteValidityDays: "7.5" })).quoteValidityDays).toMatch(/whole days/);
    expect(issues(values({ defaultGstPercent: "101" })).defaultGstPercent).toMatch(/100%/);
    expect(issues(values({ defaultGstPercent: "" })).defaultGstPercent).toMatch(/0 for none/);
    expect(parseGstPercent("18%")).toEqual({ ok: true, value: 18 });
    expect(parseValidityDays(" 30 ")).toEqual({ ok: true, value: 30 });
  });

  it("flags duplicate 'not included' items but ignores blank rows", () => {
    const e = issues(values({ defaultNotIncluded: [{ value: "Civil work" }, { value: "" }, { value: " civil WORK " }] }));
    expect(e).toEqual({ "defaultNotIncluded.2.value": "This is already in the list." });
  });
});

describe("toSettingsBody", () => {
  it("trims, parses numbers, drops blank list rows and leaves untouched images out", () => {
    const body = toSettingsBody(
      values({ companyName: " Velan ", defaultNotIncluded: [{ value: " Painting " }, { value: " " }], quoteValidityDays: "30", defaultGstPercent: "12.5" }),
      NO_IMAGE_CHANGES,
      saved,
    );
    expect(body).toMatchObject({
      companyName: "Velan",
      defaultNotIncluded: ["Painting"],
      quoteValidityDays: 30,
      defaultGstPercent: 12.5,
      roundAmounts: true,
    });
    expect(body).not.toHaveProperty("logoUrl");
    expect(body).not.toHaveProperty("coverImageUrl");
  });

  it("sends a new upload's ref, and '' to clear a saved image", () => {
    const changes = {
      ...NO_IMAGE_CHANGES,
      logoUrl: { kind: "remove" as const },
      coverImageUrl: { kind: "replace" as const, ref: "sb://quotations/quotation/branding/cover.jpg", previewUrl: "blob:x" },
      watermarkLogoUrl: { kind: "remove" as const }, // nothing saved: no-op
    };
    expect(imageBody(changes, saved)).toEqual({ logoUrl: "", coverImageUrl: "sb://quotations/quotation/branding/cover.jpg" });
    expect(hasImageChanges(changes, saved)).toBe(true);
    expect(hasImageChanges({ ...NO_IMAGE_CHANGES, watermarkLogoUrl: { kind: "remove" } }, saved)).toBe(false);
  });

  it("shows the right image for each slot state", () => {
    expect(displayedImage({ kind: "keep" }, "a")).toBe("a");
    expect(displayedImage({ kind: "remove" }, "a")).toBe("");
    expect(displayedImage({ kind: "replace", ref: "sb://x/y", previewUrl: "blob:p" }, "a")).toBe("blob:p");
  });
});

describe("quoteNumberExample", () => {
  it("matches the API's numbering (no doubled dash)", () => {
    expect(quoteNumberExample("QUO-", 2026)).toBe("QUO-2026-0001");
    expect(quoteNumberExample("VS", 2026)).toBe("VS-2026-0001");
    expect(quoteNumberExample("  ", 2026)).toBe("QUO-2026-0001");
  });
});

describe("validateBrandingImage", () => {
  it("accepts png/jpg/webp up to 5 MB", () => {
    expect(validateBrandingImage({ name: "a.png", size: 100 }, "png")).toBeNull();
    expect(validateBrandingImage({ name: "a.gif", size: 100 }, "gif")).toMatch(/PNG, JPG or WebP/);
    expect(validateBrandingImage({ name: "a.jpg", size: 6 * 1024 * 1024 }, "jpg")).toMatch(/5 MB/);
  });
});
