import { describe, expect, it } from "vitest";
import { normalizeDesign } from "@/lib/api/project-content";
import {
  approvalStateOf,
  designGroupOf,
  designTitle,
  designTitlesFor,
  groupDesigns,
  numberedTitles,
  splitDocuments,
  titleFromFileName,
} from "./design-utils";

const design = (over: Record<string, unknown>) =>
  normalizeDesign({ id: "d", projectId: "p", createdAt: "2026-10-14T10:00:00Z", ...over });

describe("designGroupOf", () => {
  it("understands current and legacy type values", () => {
    expect(designGroupOf("2D")).toBe("2d");
    expect(designGroupOf("2D Plan")).toBe("2d");
    expect(designGroupOf("3D")).toBe("3d");
    expect(designGroupOf("3D Render")).toBe("3d");
    expect(designGroupOf("Quotation")).toBe("quotation");
    expect(designGroupOf("Elevation")).toBe("other");
    expect(designGroupOf("")).toBe("other");
  });
});

describe("groupDesigns", () => {
  it("returns non-empty groups in a fixed order, keeping item order", () => {
    const groups = groupDesigns([
      design({ id: "a", type: "3D Render" }),
      design({ id: "b", type: "2D Plan" }),
      design({ id: "c", type: "3D" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["2d", "3d"]);
    expect(groups[1].items.map((d) => d.id)).toEqual(["a", "c"]);
  });
});

describe("splitDocuments", () => {
  it("separates quotation PDFs from design drawings (client Documents section)", () => {
    const { designs, quotations } = splitDocuments([
      design({ id: "q", type: "Quotation" }),
      design({ id: "d", type: "2D" }),
    ]);
    expect(designs.map((d) => d.id)).toEqual(["d"]);
    expect(quotations.map((d) => d.id)).toEqual(["q"]);
  });
});

describe("titles", () => {
  it("numbers a shared title only when there are several files", () => {
    expect(numberedTitles("Kitchen", 1)).toEqual(["Kitchen"]);
    expect(numberedTitles("Kitchen", 3)).toEqual(["Kitchen (1)", "Kitchen (2)", "Kitchen (3)"]);
    expect(numberedTitles("Kitchen", 0)).toEqual([]);
  });

  it("derives a readable title from a file name", () => {
    expect(titleFromFileName("master_bedroom-3d.render.PNG")).toBe("master bedroom 3d.render");
    expect(titleFromFileName(".pdf")).toBe("Untitled design");
  });

  it("uses each file's own name when no title is typed", () => {
    expect(designTitlesFor("  ", ["Living room.pdf", "kitchen_plan.jpg"])).toEqual(["Living room", "kitchen plan"]);
  });

  it("uses the typed title (numbered) when given", () => {
    expect(designTitlesFor("Ground floor", ["a.pdf", "b.pdf"])).toEqual(["Ground floor (1)", "Ground floor (2)"]);
  });

  it("caps titles at the API's 300 characters", () => {
    expect(designTitlesFor("x".repeat(400), ["a.pdf", "b.pdf"])[1].length).toBeLessThanOrEqual(300);
  });
});

describe("designTitle", () => {
  it("falls back to the stored file name", () => {
    expect(designTitle(design({ title: "Plan A" }))).toBe("Plan A");
    expect(designTitle(design({ fileUrl: "https://x/storage/v1/object/sign/designs/p/0a1b2c3d-plan-b.pdf?token=t" }))).toBe(
      "plan-b.pdf",
    );
    expect(designTitle(design({}))).toBe("Untitled design");
  });
});

describe("approvalStateOf", () => {
  it("maps the two approval flags", () => {
    expect(approvalStateOf(design({}))).toBe("not-required");
    expect(approvalStateOf(design({ approvalRequired: true }))).toBe("pending");
    expect(approvalStateOf(design({ approvalRequired: true, approvalApproved: true }))).toBe("approved");
    expect(approvalStateOf(design({ approvalApproved: true }))).toBe("approved");
  });
});
