import { describe, expect, it } from "vitest";
import { UTF8_BOM, csvFileName, csvText, csvMoney, toCsv } from "./csv";

describe("csvText", () => {
  it("leaves simple text alone", () => {
    expect(csvText("Cement bags")).toBe("Cement bags");
  });

  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(csvText("Tiles, grout")).toBe('"Tiles, grout"');
    expect(csvText('6" pipe')).toBe('"6"" pipe"');
    expect(csvText("line 1\nline 2")).toBe('"line 1\nline 2"');
  });

  it("neutralises spreadsheet formulas in user text", () => {
    expect(csvText("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvText("+91 98765")).toBe("'+91 98765");
    expect(csvText("-advance")).toBe("'-advance");
    expect(csvText("@sum")).toBe("'@sum");
  });

  it("writes empty cells for missing values", () => {
    expect(csvText(null)).toBe("");
    expect(csvText(undefined)).toBe("");
  });
});

describe("csvMoney", () => {
  it("writes plain numbers with 2 decimals (no ₹, no grouping)", () => {
    expect(csvMoney(1_500_000)).toBe("1500000.00");
    expect(csvMoney(1234.5)).toBe("1234.50");
    expect(csvMoney(0.1 + 0.2)).toBe("0.30");
  });

  it("keeps negative numbers numeric (no formula guard)", () => {
    expect(csvMoney(-20)).toBe("-20.00");
  });
});

describe("toCsv", () => {
  type Row = { date: string; who: string; amount: number };
  const columns = [
    { header: "Date", value: (r: Row) => r.date },
    { header: "Paid to", value: (r: Row) => r.who },
    { header: "Amount (₹)", value: (r: Row) => r.amount, money: true },
  ];

  it("starts with a UTF-8 BOM so Excel shows ₹", () => {
    const csv = toCsv(columns, []);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${UTF8_BOM}Date,Paid to,Amount (₹)\r\n`);
  });

  it("writes one CRLF line per row", () => {
    const csv = toCsv(columns, [
      { date: "2026-10-01", who: "Ravi, Tiles", amount: 1500 },
      { date: "2026-10-02", who: "Asha", amount: 99.9 },
    ]);
    expect(csv).toBe(
      `${UTF8_BOM}Date,Paid to,Amount (₹)\r\n2026-10-01,"Ravi, Tiles",1500.00\r\n2026-10-02,Asha,99.90\r\n`,
    );
  });
});

describe("csvFileName", () => {
  it("builds a safe, dated file name", () => {
    expect(csvFileName(["VS/001", "Expenses"], "2026-10-14")).toBe("vs-001-expenses-2026-10-14.csv");
    expect(csvFileName(["", "settlements"], "2026-10-14")).toBe("settlements-2026-10-14.csv");
  });
});
