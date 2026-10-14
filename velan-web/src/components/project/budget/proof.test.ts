import { describe, expect, it } from "vitest";
import { MAX_PROOF_BYTES, proofKind, resolveProofChange, validateProofFile } from "./proof";

describe("validateProofFile", () => {
  it("accepts images and PDFs", () => {
    expect(validateProofFile({ name: "bill.JPG", size: 1000 })).toBeNull();
    expect(validateProofFile({ name: "receipt.pdf", size: 1000 })).toBeNull();
    expect(validateProofFile({ name: "photo.heic", size: 1000 })).toBeNull();
  });

  it("rejects other file types", () => {
    expect(validateProofFile({ name: "notes.docx", size: 1000 })).toMatch(/image or a PDF/);
    expect(validateProofFile({ name: "noext", size: 1000 })).toMatch(/image or a PDF/);
  });

  it("rejects empty and oversized files", () => {
    expect(validateProofFile({ name: "a.png", size: 0 })).toMatch(/empty/);
    expect(validateProofFile({ name: "a.png", size: MAX_PROOF_BYTES + 1 })).toMatch(/20 MB/);
  });
});

describe("proofKind", () => {
  it("detects the kind from a signed URL's path", () => {
    expect(proofKind("https://x.supabase.co/storage/v1/object/sign/project-files/projects/p/expense_proofs/ab-bill.jpg?token=abc.pdf")).toBe("image");
    expect(proofKind("https://x/storage/v1/object/sign/project-files/a/receipt.PDF?token=1")).toBe("pdf");
    expect(proofKind("https://x/storage/v1/object/sign/project-files/a/file.docx")).toBe("file");
    expect(proofKind("not a url/photo.png")).toBe("image");
    expect(proofKind(null)).toBeNull();
  });
});

describe("resolveProofChange", () => {
  it("keeps an untouched proof", () => {
    expect(resolveProofChange({ hadProof: true, removed: false, uploadedRef: null })).toEqual({ kind: "keep" });
    expect(resolveProofChange({ hadProof: false, removed: false, uploadedRef: null })).toEqual({ kind: "keep" });
  });

  it("removes a proof the user cleared", () => {
    expect(resolveProofChange({ hadProof: true, removed: true, uploadedRef: null })).toEqual({ kind: "remove" });
  });

  it("an upload wins over removal", () => {
    expect(resolveProofChange({ hadProof: true, removed: true, uploadedRef: "sb://project-files/x" })).toEqual({
      kind: "upload",
      ref: "sb://project-files/x",
    });
  });
});
