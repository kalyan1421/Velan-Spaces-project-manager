import { describe, expect, it } from "vitest";
import { normalizeFile } from "@/lib/api/project-content";
import { ensureSharedFiles, normalizeSharedFile, normalizeSharedFiles } from "./file-api";
import { documentRows, sortFilesNewestFirst } from "./file-utils";

const raw = (over: Record<string, unknown>) => ({
  id: "f",
  projectId: "p",
  name: "contract.pdf",
  storagePath: "https://x/storage/v1/object/sign/project-files/p/contract.pdf?token=t",
  uploadedAt: "2026-10-14T10:00:00Z",
  ...over,
});

describe("normalizeSharedFile", () => {
  it("reads the client visibility flag", () => {
    expect(normalizeSharedFile(raw({ clientVisible: true })).clientVisible).toBe(true);
    expect(normalizeSharedFile(raw({ clientVisible: false })).clientVisible).toBe(false);
  });

  it("is unknown (null) when the API didn't send it", () => {
    expect(normalizeSharedFile(raw({})).clientVisible).toBeNull();
    expect(normalizeSharedFile(raw({ clientVisible: "yes" })).clientVisible).toBeNull();
  });

  it("keeps the base file fields", () => {
    expect(normalizeSharedFile(raw({ clientVisible: true }))).toMatchObject({ id: "f", name: "contract.pdf", size: 0 });
    expect(normalizeSharedFiles("nope")).toEqual([]);
  });

  it("marks rows from the older normalizer as unknown, leaving complete rows alone", () => {
    const old = normalizeFile(raw({ clientVisible: true }));
    expect(ensureSharedFiles([old])[0].clientVisible).toBeNull();
    const full = normalizeSharedFile(raw({ clientVisible: false }));
    expect(ensureSharedFiles([full])[0]).toBe(full);
  });
});

describe("client documents", () => {
  it("lists shared files with quotation PDFs, newest first, and sorts any file subtype", () => {
    const files = normalizeSharedFiles([
      raw({ id: "a", uploadedAt: "2026-10-01T00:00:00Z", clientVisible: true }),
      raw({ id: "b", uploadedAt: "2026-10-10T00:00:00Z", clientVisible: true }),
    ]);
    expect(sortFilesNewestFirst(files).map((f) => f.id)).toEqual(["b", "a"]);
    const rows = documentRows([], files);
    expect(rows.map((r) => r.key)).toEqual(["f-b", "f-a"]);
  });
});
