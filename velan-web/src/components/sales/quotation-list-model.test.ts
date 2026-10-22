import { describe, expect, it } from "vitest";
import { normalizeQuote, type Quote } from "@/lib/api/sales-types";
import { countQuotationsByStatus, filterQuotations, quotationPerson } from "./quotation-list-model";

const q = (over: Record<string, unknown>): Quote =>
  normalizeQuote({ id: "x", status: "draft", createdAt: "2026-10-01T00:00:00Z", ...over });

const quotes = [
  q({ id: "a", quoteNumber: "QUO-2026-0001", preparedForName: "Asha Raman", siteLocation: "Adyar", status: "sent", createdAt: "2026-10-02T00:00:00Z" }),
  q({ id: "b", quoteNumber: "QUO-2026-0002", preparedForName: "Ravi Traders", preparedForPhone: "+919000000001", status: "draft", createdAt: "2026-10-05T00:00:00Z" }),
  q({ id: "c", quoteNumber: "QUO-2026-0003", preparedForName: "", status: "accepted", createdAt: "2026-10-03T00:00:00Z" }),
];

describe("filterQuotations", () => {
  it("sorts newest first", () => {
    expect(filterQuotations(quotes, "", "all").map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("searches number, name, phone and location (all words must match)", () => {
    expect(filterQuotations(quotes, "0002", "all").map((x) => x.id)).toEqual(["b"]);
    expect(filterQuotations(quotes, "asha adyar", "all").map((x) => x.id)).toEqual(["a"]);
    expect(filterQuotations(quotes, "9000000001", "all").map((x) => x.id)).toEqual(["b"]);
    expect(filterQuotations(quotes, "nobody", "all")).toEqual([]);
  });

  it("filters by status", () => {
    expect(filterQuotations(quotes, "", "sent").map((x) => x.id)).toEqual(["a"]);
  });
});

describe("helpers", () => {
  it("counts by status", () => {
    expect(countQuotationsByStatus(quotes)).toEqual({ all: 3, draft: 1, sent: 1, accepted: 1, rejected: 0 });
  });
  it("names a nameless quote", () => {
    expect(quotationPerson(quotes[2])).toBe("No name");
  });
});
