import { describe, expect, it } from "vitest";
import {
  displayFileName,
  downloadUrl,
  fileTypeLabel,
  formatBytes,
  mediaKindOfFile,
  mediaKindOfUrl,
  planUpdateMedia,
  validateFiles,
  MAX_UPDATE_PHOTOS,
} from "./media";

const SIGNED = "https://abc.supabase.co/storage/v1/object/sign/update-images/projects/p1/updates/ab12cd34-site.JPG?token=xyz";

describe("mediaKindOfUrl", () => {
  it("detects images, videos and PDFs from signed URLs (ignoring the token)", () => {
    expect(mediaKindOfUrl(SIGNED)).toBe("image");
    expect(mediaKindOfUrl("https://x.supabase.co/storage/v1/object/sign/designs/projects/p/designs/a-plan.pdf?token=1")).toBe("pdf");
    expect(mediaKindOfUrl("https://x/clip.MOV#t=1")).toBe("video");
  });

  it("decodes legacy Firebase download URLs", () => {
    const url =
      "https://firebasestorage.googleapis.com/v0/b/app.appspot.com/o/projects%2Fp1%2Fupdates%2Fphoto.jpeg?alt=media&token=t";
    expect(mediaKindOfUrl(url)).toBe("image");
  });

  it("falls back to the update type hint, then to 'document'", () => {
    expect(mediaKindOfUrl("https://x/blob", "video")).toBe("video");
    expect(mediaKindOfUrl("https://x/blob", "photo")).toBe("image");
    expect(mediaKindOfUrl("https://x/report.docx")).toBe("document");
    expect(mediaKindOfUrl("not a url")).toBe("document");
  });
});

describe("mediaKindOfFile", () => {
  it("prefers the extension and falls back to the MIME type", () => {
    expect(mediaKindOfFile({ name: "a.heic", type: "" })).toBe("image");
    expect(mediaKindOfFile({ name: "a.mp4", type: "video/mp4" })).toBe("video");
    expect(mediaKindOfFile({ name: "image", type: "image/png" })).toBe("image");
    expect(mediaKindOfFile({ name: "spec.pdf", type: "application/pdf" })).toBe("pdf");
    expect(mediaKindOfFile({ name: "notes.txt", type: "text/plain" })).toBe("document");
  });
});

describe("formatBytes", () => {
  it("uses short human units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(1.25 * 1024 ** 3)).toBe("1.3 GB");
  });

  it("returns an em dash for unknown sizes", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });
});

describe("fileTypeLabel", () => {
  it("names common document types", () => {
    expect(fileTypeLabel("Contract.PDF")).toBe("PDF");
    expect(fileTypeLabel("bill.xlsx")).toBe("Excel");
    expect(fileTypeLabel("scope.docx")).toBe("Word");
    expect(fileTypeLabel("deck.pptx")).toBe("PowerPoint");
    expect(fileTypeLabel("photo.jpg")).toBe("Image");
    expect(fileTypeLabel("walkthrough.mov")).toBe("Video");
    expect(fileTypeLabel("archive")).toBe("File");
  });
});

describe("displayFileName", () => {
  it("strips the random upload prefix from the stored object name", () => {
    expect(displayFileName("https://x/storage/v1/object/sign/designs/projects/p/designs/ab12cd34-kitchen-plan.pdf?token=1")).toBe(
      "kitchen-plan.pdf",
    );
    expect(displayFileName("https://x/report.pdf")).toBe("report.pdf");
    expect(displayFileName("")).toBe("file");
  });
});

describe("downloadUrl", () => {
  it("asks Supabase for an attachment on its signed URLs", () => {
    expect(downloadUrl(SIGNED, "Site photo.jpg")).toBe(`${SIGNED}&download=Site%20photo.jpg`);
  });

  it("leaves other URLs untouched", () => {
    expect(downloadUrl("https://firebasestorage.googleapis.com/x?alt=media", "a.jpg")).toBe(
      "https://firebasestorage.googleapis.com/x?alt=media",
    );
  });
});

const file = (name: string, size = 1000, type = "") => ({ name, size, type });

describe("validateFiles", () => {
  it("splits accepted and rejected files with a reason", () => {
    const { accepted, rejected } = validateFiles([file("plan.pdf"), file("virus.exe"), file("huge.pdf", 10)], {
      extensions: new Set(["pdf"]),
      maxBytes: 5,
      label: "designs",
    });
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "File is too large (max 5 B).",
      "This file type can't be added to designs.",
      "File is too large (max 5 B).",
    ]);
  });

  it("accepts files that match", () => {
    const { accepted } = validateFiles([file("plan.PDF")], { extensions: new Set(["pdf"]), maxBytes: 5000, label: "designs" });
    expect(accepted).toHaveLength(1);
  });
});

describe("planUpdateMedia", () => {
  it("accepts several photos", () => {
    const plan = planUpdateMedia([], [file("a.jpg"), file("b.png")]);
    expect(plan.accepted).toHaveLength(2);
    expect(plan.rejected).toEqual([]);
  });

  it("accepts one video on its own", () => {
    const plan = planUpdateMedia([], [file("clip.mp4")]);
    expect(plan.accepted.map((f) => f.name)).toEqual(["clip.mp4"]);
  });

  it("rejects a second video and photos mixed with a video", () => {
    const plan = planUpdateMedia([], [file("clip.mp4"), file("b.jpg"), file("other.mov")]);
    expect(plan.accepted.map((f) => f.name)).toEqual(["clip.mp4"]);
    expect(plan.rejected).toHaveLength(2);
  });

  it("rejects a video when photos are already attached", () => {
    const plan = planUpdateMedia(["image"], [file("clip.mp4")]);
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0].reason).toMatch(/one video/);
  });

  it("rejects HEIC photos, which most browsers can't display", () => {
    const plan = planUpdateMedia([], [file("IMG_0001.HEIC")]);
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected[0].reason).toMatch(/JPEG/);
  });

  it("rejects documents and unsupported types", () => {
    const plan = planUpdateMedia([], [file("spec.pdf"), file("run.exe")]);
    expect(plan.accepted).toEqual([]);
    expect(plan.rejected.map((r) => r.file.name)).toEqual(["spec.pdf", "run.exe"]);
  });

  it(`caps photos at ${MAX_UPDATE_PHOTOS}`, () => {
    const existing = Array.from({ length: MAX_UPDATE_PHOTOS - 1 }, () => "image" as const);
    const plan = planUpdateMedia(existing, [file("a.jpg"), file("b.jpg")]);
    expect(plan.accepted.map((f) => f.name)).toEqual(["a.jpg"]);
    expect(plan.rejected[0].reason).toMatch(String(MAX_UPDATE_PHOTOS));
  });

  it("rejects oversized photos and videos", () => {
    const plan = planUpdateMedia([], [file("big.jpg", 60 * 1024 * 1024)]);
    expect(plan.rejected[0].reason).toMatch(/too large/);
  });
});
