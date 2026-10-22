import { describe, expect, it } from "vitest";
import { normalizeDesign, normalizeFile } from "@/lib/api/project-content";
import {
  buildCreateFileBody,
  documentRows,
  fileDisplayName,
  fileKind,
  fileNameWithExtension,
  sortFilesNewestFirst,
} from "./file-utils";

const file = (over: Record<string, unknown>) => normalizeFile({ id: "f", projectId: "p", ...over });

describe("fileDisplayName", () => {
  it("prefers the title, then the name, then the stored object name", () => {
    expect(fileDisplayName(file({ title: "Contract", name: "contract-v2.pdf" }))).toBe("Contract");
    expect(fileDisplayName(file({ name: "contract-v2.pdf" }))).toBe("contract-v2.pdf");
    expect(fileDisplayName(file({ storagePath: "https://x/storage/v1/object/sign/project-files/p/0a1b2c3d-bill.xlsx?t=1" }))).toBe(
      "bill.xlsx",
    );
    expect(fileDisplayName(file({}))).toBe("Untitled file");
  });
});

describe("fileNameWithExtension / fileKind", () => {
  it("finds a name with an extension for type labels", () => {
    expect(fileNameWithExtension(file({ title: "Contract", name: "contract.pdf" }))).toBe("contract.pdf");
    expect(fileKind(file({ title: "Contract", name: "contract.pdf" }))).toBe("pdf");
  });

  it("falls back to the signed URL", () => {
    expect(fileKind(file({ title: "Walkthrough", storagePath: "https://x/a/b/clip.mp4?token=1" }))).toBe("video");
  });
});

describe("buildCreateFileBody", () => {
  it("describes the uploaded file", () => {
    expect(buildCreateFileBody({ name: "Site Survey.PDF", size: 2048.4, type: "application/pdf" }, "sb://project-files/projects/p/files/a.pdf")).toEqual({
      name: "Site Survey.PDF",
      title: "Site Survey",
      storagePath: "sb://project-files/projects/p/files/a.pdf",
      category: "document",
      type: "pdf",
      size: 2048,
    });
  });

  it("categorises photos and videos", () => {
    expect(buildCreateFileBody({ name: "a.jpg", size: 1, type: "image/jpeg" }, "sb://x/y").category).toBe("image");
    expect(buildCreateFileBody({ name: "a.mov", size: 1, type: "" }, "sb://x/y").category).toBe("video");
  });
});

describe("sortFilesNewestFirst", () => {
  it("orders by upload time, newest first", () => {
    const sorted = sortFilesNewestFirst([
      file({ id: "old", uploadedAt: "2026-01-01T00:00:00Z" }),
      file({ id: "none" }),
      file({ id: "new", uploadedAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["new", "old", "none"]);
  });
});

describe("documentRows", () => {
  it("lists quotation PDFs and files (not drawings), newest first", () => {
    const rows = documentRows(
      [
        normalizeDesign({ id: "q1", type: "Quotation", title: "Quotation VS-2026-014", fileUrl: "https://x/a/0a1b2c3d-q.pdf?t=1", createdAt: "2026-10-10T00:00:00Z" }),
        normalizeDesign({ id: "d1", type: "2D Plan", title: "Ground floor", createdAt: "2026-10-12T00:00:00Z" }),
      ],
      [file({ id: "f1", name: "Contract.pdf", size: 1024, storagePath: "https://x/c.pdf", uploadedAt: "2026-10-11T00:00:00Z" })],
    );
    expect(rows.map((r) => r.key)).toEqual(["f-f1", "q-q1"]);
    expect(rows[1]).toMatchObject({ title: "Quotation VS-2026-014", label: "Quotation", fileName: "q.pdf" });
    expect(rows[0]).toMatchObject({ title: "Contract.pdf", label: "PDF", size: 1024 });
  });
});
