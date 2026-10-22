import { describe, expect, it } from "vitest";
import { pdfDisposition, safePdfFileName } from "./disposition";

describe("safePdfFileName", () => {
  it("keeps the API's quote-number filename", () => {
    expect(safePdfFileName('inline; filename="QUO-2026-0007.pdf"')).toBe("QUO-2026-0007.pdf");
    expect(safePdfFileName("attachment; filename=QUO-2026-0007.pdf")).toBe("QUO-2026-0007.pdf");
  });

  it("prefers filename* and decodes it", () => {
    expect(safePdfFileName(`inline; filename="x.pdf"; filename*=UTF-8''Quote%20One.pdf`)).toBe("Quote-One.pdf");
  });

  it("strips paths, quotes and header-breaking characters", () => {
    expect(safePdfFileName('inline; filename="../../etc/passwd"')).toBe("passwd.pdf");
    expect(safePdfFileName('inline; filename="a\\"b.pdf"')).toBe("quote.pdf");
    expect(safePdfFileName('inline; filename="QUO\r\nX-Evil: 1.pdf"')).toBe("QUO-X-Evil-1.pdf");
    expect(safePdfFileName('inline; filename="QUO 2026/0007"')).toBe("0007.pdf");
  });

  it("falls back to quote.pdf", () => {
    expect(safePdfFileName(null)).toBe("quote.pdf");
    expect(safePdfFileName("inline")).toBe("quote.pdf");
    expect(safePdfFileName('inline; filename="///"')).toBe("quote.pdf");
  });
});

describe("pdfDisposition", () => {
  it("switches between inline and attachment", () => {
    expect(pdfDisposition('inline; filename="QUO-1.pdf"', true)).toBe('attachment; filename="QUO-1.pdf"');
    expect(pdfDisposition(null, false)).toBe('inline; filename="quote.pdf"');
  });
});
