import { describe, expect, it } from "vitest";

import {
  enquirySchema,
  fieldErrorsFromApi,
  fieldErrorsFromZod,
  normalizeIndianMobile,
  toEnquiryApiPayload,
} from "../enquiry-schema";

const valid = {
  name: "Priya Raman",
  phone: "98765 43210",
  email: "",
  location: "",
  projectType: "",
  budgetRange: "",
  message: "",
  company: "",
  consent: true,
};

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["(+91) 98765.43210", "+919876543210"],
    ["91 9876543210", "+919876543210"],
    ["098765 43210", "+919876543210"],
    ["0091 6123456789", "+916123456789"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["12345"],
    ["5876543210"], // mobiles start with 6–9
    ["98765432101"], // 11 digits
    ["+1 415 555 0100"],
    ["+92 98765 43210"],
    ["98765abcde"],
    [""],
  ])("rejects %s", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("enquirySchema", () => {
  it("accepts the minimum enquiry and normalises the phone", () => {
    const result = enquirySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.phone).toBe("+919876543210");
    expect(result.data.email).toBeUndefined();
    expect(result.data.location).toBeUndefined();
    expect(result.data.projectType).toBeUndefined();
  });

  it("requires a name, a valid mobile and consent", () => {
    const result = enquirySchema.safeParse({ ...valid, name: " ", phone: "12345", consent: false });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrorsFromZod(result.error);
    expect(Object.keys(errors).sort()).toEqual(["consent", "name", "phone"]);
    expect(errors.phone).toMatch(/Indian mobile/);
  });

  it("treats missing consent as not agreed", () => {
    const { consent: _omit, ...withoutConsent } = valid;
    void _omit;
    const result = enquirySchema.safeParse(withoutConsent);
    expect(result.success).toBe(false);
  });

  it("validates optional email only when given", () => {
    expect(enquirySchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    const ok = enquirySchema.safeParse({ ...valid, email: " Priya@Example.com " });
    expect(ok.success && ok.data.email).toBe("priya@example.com");
  });

  it("only accepts listed project types and budget ranges", () => {
    expect(enquirySchema.safeParse({ ...valid, projectType: "Modular kitchens" }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...valid, projectType: "Swimming pool" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...valid, budgetRange: "₹10–20 L" }).success).toBe(true);
    expect(enquirySchema.safeParse({ ...valid, budgetRange: "₹1 Cr" }).success).toBe(false);
  });

  it("lets a filled honeypot pass validation so it can be forwarded (and dropped by the API)", () => {
    const result = enquirySchema.safeParse({ ...valid, company: "Bot Corp" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.company).toBe("Bot Corp");
    expect(toEnquiryApiPayload(result.data).company).toBe("Bot Corp");
  });
});

describe("toEnquiryApiPayload", () => {
  it("sends only API fields, omitting empty optionals and consent", () => {
    const parsed = enquirySchema.parse({
      ...valid,
      location: "Anna Nagar",
      projectType: "Modular kitchens",
      budgetRange: "₹5–10 L",
      message: "  Two-bedroom flat  ",
    });
    expect(toEnquiryApiPayload(parsed)).toEqual({
      name: "Priya Raman",
      phone: "+919876543210",
      location: "Anna Nagar",
      projectType: "Modular kitchens",
      budgetRange: "₹5–10 L",
      message: "Two-bedroom flat",
    });
  });
});

describe("fieldErrorsFromApi", () => {
  it("maps class-validator messages onto form fields", () => {
    const { fieldErrors, unmatched } = fieldErrorsFromApi({
      statusCode: 400,
      message: ["phone must be a valid phone number", "email must be an email", "something odd"],
    });
    expect(fieldErrors).toEqual({
      phone: "Please check your mobile number",
      email: "Please check your email address",
    });
    expect(unmatched).toEqual(["something odd"]);
  });

  it("handles a single string message and junk bodies", () => {
    expect(fieldErrorsFromApi({ message: "name should not be empty" }).fieldErrors).toEqual({
      name: "Please check your name",
    });
    expect(fieldErrorsFromApi(null).fieldErrors).toEqual({});
  });
});
