import { describe, expect, it } from "vitest";
import type { PortfolioItem } from "@/lib/api/types";
import {
  buildCreateBody,
  buildUpdateBody,
  makePortfolioFormSchema,
  toFormValues,
  type PortfolioFormValues,
} from "../portfolio-form";

const ID = "00000000-0000-4000-8000-000000000001";
const PROJECT = "11111111-1111-4111-8111-111111111111";

function item(overrides: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: ID,
    slug: "modern-villa",
    title: "Modern Villa",
    description: "Open plan living.",
    category: "residential",
    location: "Adyar, Chennai",
    completionYear: 2024,
    coverImageUrl: "https://x.supabase.co/storage/v1/object/public/portfolio/items/1/cover.jpg",
    imageUrls: ["https://x.supabase.co/storage/v1/object/public/portfolio/items/2/a.jpg"],
    status: "published",
    sortOrder: 3,
    projectId: PROJECT,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function values(overrides: Partial<PortfolioFormValues> = {}): PortfolioFormValues {
  return { ...toFormValues(), title: "Modern Villa", ...overrides };
}

// ---------------------------------------------------------------- defaults

describe("toFormValues", () => {
  it("gives empty create defaults (draft, residential, no images)", () => {
    expect(toFormValues()).toEqual({
      title: "",
      slug: "",
      category: "residential",
      location: "",
      completionYear: "",
      description: "",
      status: "draft",
      projectId: "",
      coverImageUrl: null,
      imageUrls: [],
    });
  });

  it("maps an existing item into string inputs", () => {
    expect(toFormValues(item())).toMatchObject({
      title: "Modern Villa",
      slug: "modern-villa",
      location: "Adyar, Chennai",
      completionYear: "2024",
      status: "published",
      projectId: PROJECT,
    });
  });

  it("turns nulls into empty inputs", () => {
    const v = toFormValues(item({ location: null, completionYear: null, description: null, projectId: null }));
    expect([v.location, v.completionYear, v.description, v.projectId]).toEqual(["", "", "", ""]);
  });
});

// ---------------------------------------------------------------- schema

describe("makePortfolioFormSchema", () => {
  const create = makePortfolioFormSchema({ mode: "create", takenSlugs: [] });
  const edit = makePortfolioFormSchema({ mode: "edit", takenSlugs: [] });

  function errors(schema: typeof create, v: PortfolioFormValues) {
    const r = schema.safeParse(v);
    return r.success ? {} : r.error.flatten().fieldErrors;
  }

  it("accepts a minimal valid item", () => {
    expect(create.safeParse(values()).success).toBe(true);
  });

  it("requires a title of 2–120 characters (after trimming)", () => {
    expect(errors(create, values({ title: " a " })).title?.[0]).toMatch(/at least 2/);
    expect(errors(create, values({ title: "x".repeat(121) })).title?.[0]).toMatch(/120/);
  });

  it("lets the slug be empty on create (the API generates it) but not on edit", () => {
    expect(create.safeParse(values({ slug: "" })).success).toBe(true);
    expect(errors(edit, values({ slug: "" })).slug?.[0]).toMatch(/web address/);
  });

  it("validates the slug format", () => {
    expect(errors(create, values({ slug: "Bad Slug" })).slug?.[0]).toMatch(/lowercase/);
  });

  it("flags a slug used by another item", () => {
    const schema = makePortfolioFormSchema({ mode: "create", takenSlugs: ["modern-villa"] });
    expect(errors(schema, values({ slug: "modern-villa" })).slug?.[0]).toMatch(/already used/);
  });

  it("validates the completion year (empty, or 1990–2100)", () => {
    expect(create.safeParse(values({ completionYear: "" })).success).toBe(true);
    expect(create.safeParse(values({ completionYear: "2024" })).success).toBe(true);
    expect(errors(create, values({ completionYear: "1989" })).completionYear?.[0]).toMatch(/1990/);
    expect(errors(create, values({ completionYear: "20x4" })).completionYear?.[0]).toMatch(/year/);
    expect(errors(create, values({ completionYear: "2024.5" })).completionYear?.[0]).toMatch(/year/);
  });

  it("caps location and description lengths", () => {
    expect(errors(create, values({ location: "x".repeat(121) })).location?.[0]).toMatch(/120/);
    expect(errors(create, values({ description: "x".repeat(5001) })).description?.[0]).toMatch(/5000/);
  });

  it("rejects more than 40 gallery photos or duplicates", () => {
    const many = Array.from({ length: 41 }, (_, i) => `https://x/p${i}.jpg`);
    expect(errors(create, values({ imageUrls: many })).imageUrls?.[0]).toMatch(/40/);
    expect(errors(create, values({ imageUrls: ["https://x/a.jpg", "https://x/a.jpg"] })).imageUrls?.[0]).toMatch(
      /twice/,
    );
  });

  it("only accepts known categories and statuses", () => {
    expect(create.safeParse(values({ category: "villa" as never })).success).toBe(false);
    expect(create.safeParse(values({ status: "archived" as never })).success).toBe(false);
  });
});

// ---------------------------------------------------------------- request bodies

describe("buildCreateBody", () => {
  it("omits empty optional fields and lets the API generate the slug", () => {
    expect(buildCreateBody(values({ slug: "modern-villa" }), { slugEdited: false })).toEqual({
      title: "Modern Villa",
      category: "residential",
      status: "draft",
      imageUrls: [],
    });
  });

  it("sends a slug the user typed, plus every filled field (trimmed, typed)", () => {
    const body = buildCreateBody(
      values({
        title: "  Modern Villa ",
        slug: "villa-adyar",
        location: " Adyar ",
        completionYear: "2024",
        description: "  Calm.  ",
        status: "published",
        projectId: PROJECT,
        coverImageUrl: "https://x/c.jpg",
        imageUrls: ["https://x/a.jpg"],
        category: "kitchen",
      }),
      { slugEdited: true },
    );
    expect(body).toEqual({
      title: "Modern Villa",
      slug: "villa-adyar",
      location: "Adyar",
      completionYear: 2024,
      description: "Calm.",
      status: "published",
      projectId: PROJECT,
      coverImageUrl: "https://x/c.jpg",
      imageUrls: ["https://x/a.jpg"],
      category: "kitchen",
    });
  });
});

describe("buildUpdateBody", () => {
  it("is empty when nothing changed", () => {
    const original = item();
    expect(buildUpdateBody(original, toFormValues(original))).toEqual({});
  });

  it("sends only the changed fields", () => {
    const original = item();
    const body = buildUpdateBody(original, { ...toFormValues(original), title: "Modern Villa II", status: "hidden" });
    expect(body).toEqual({ title: "Modern Villa II", status: "hidden" });
  });

  it("sends null to clear nullable fields", () => {
    const original = item();
    const body = buildUpdateBody(original, {
      ...toFormValues(original),
      location: " ",
      completionYear: "",
      description: "",
      projectId: "",
      coverImageUrl: null,
    });
    expect(body).toEqual({
      location: null,
      completionYear: null,
      description: null,
      projectId: null,
      coverImageUrl: null,
    });
  });

  it("sends the full gallery when its order or content changed", () => {
    const original = item({ imageUrls: ["u1", "u2"] });
    expect(buildUpdateBody(original, { ...toFormValues(original), imageUrls: ["u2", "u1"] })).toEqual({
      imageUrls: ["u2", "u1"],
    });
  });

  it("ignores whitespace-only edits", () => {
    const original = item();
    expect(buildUpdateBody(original, { ...toFormValues(original), title: " Modern Villa  " })).toEqual({});
  });

  it("sends a changed slug", () => {
    const original = item();
    expect(buildUpdateBody(original, { ...toFormValues(original), slug: "villa-adyar" })).toEqual({
      slug: "villa-adyar",
    });
  });
});
