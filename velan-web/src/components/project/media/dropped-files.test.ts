import { describe, expect, it } from "vitest";
import { filesFromClipboard, namePastedFile } from "./dropped-files";

describe("namePastedFile", () => {
  it("gives generic clipboard images a unique, dated name", () => {
    const file = new File([new Uint8Array(3)], "image.png", { type: "image/png" });
    const named = namePastedFile(file, 1, new Date("2026-10-14T09:08:07.000Z"));
    expect(named.name).toBe("pasted-20261014-090807-2.png");
    expect(named.size).toBe(3);
  });

  it("keeps real file names", () => {
    const file = new File([new Uint8Array(1)], "site.jpg", { type: "image/jpeg" });
    expect(namePastedFile(file, 0)).toBe(file);
  });
});

describe("filesFromClipboard", () => {
  it("returns nothing for an empty clipboard", () => {
    expect(filesFromClipboard(null)).toEqual([]);
  });

  it("reads files, falling back to file items", () => {
    const file = new File([new Uint8Array(1)], "a.png", { type: "image/png" });
    const withFiles = { files: [file], items: [] } as unknown as DataTransfer;
    expect(filesFromClipboard(withFiles)).toEqual([file]);
    const withItems = {
      files: [],
      items: [
        { kind: "string", getAsFile: () => null },
        { kind: "file", getAsFile: () => file },
      ],
    } as unknown as DataTransfer;
    expect(filesFromClipboard(withItems)).toEqual([file]);
  });
});
