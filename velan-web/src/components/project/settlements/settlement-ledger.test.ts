import { describe, expect, it } from "vitest";
import type { Settlement } from "@/lib/api/money";
import { UTF8_BOM } from "@/components/project/budget/csv";
import {
  DEFAULT_SETTLEMENT_FILTERS,
  DEFAULT_SETTLEMENT_SORT,
  filterSettlements,
  hasActiveSettlementFilters,
  parseSettlementFilters,
  parseSettlementSort,
  settlementFilterParams,
  settlementsCsv,
  summarizeSettlements,
} from "./settlement-ledger";

const NOW = new Date("2026-10-14T04:30:00Z");

function settlement(partial: Partial<Settlement> & Pick<Settlement, "id">): Settlement {
  return {
    amount: 100,
    date: "2026-10-01",
    paidTo: "",
    description: "",
    mode: "",
    proofUrl: null,
    createdBy: null,
    createdByName: null,
    createdAt: "2026-10-01T05:00:00Z",
    ...partial,
  };
}

const ROWS = [
  settlement({ id: "a", amount: 25000, date: "2026-09-28", paidTo: "Ravi Tiles", description: "Advance", mode: "UPI" }),
  settlement({ id: "b", amount: 1200.45, date: "2026-10-03", paidTo: "Sri Electricals", description: "Wiring", mode: "Cash" }),
  settlement({ id: "c", amount: 0.1, date: "2026-10-12", paidTo: "Asha", description: "Tiles balance", mode: "Bank transfer" }),
];

const q = (s: string) => new URLSearchParams(s);
const ids = (rows: Settlement[]) => rows.map((r) => r.id);

describe("settlement URL state", () => {
  it("defaults to all rows, newest first", () => {
    expect(parseSettlementFilters(q(""))).toEqual(DEFAULT_SETTLEMENT_FILTERS);
    expect(parseSettlementSort(q(""))).toEqual({ id: "date", desc: true });
  });

  it("round-trips search, range and sort", () => {
    const filters = { q: "tiles", range: { preset: "last-30-days" as const, from: null, to: null } };
    const sort = { id: "paidTo", desc: false };
    const p = settlementFilterParams(filters, sort);
    const qs = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => e[1] !== null));
    expect(parseSettlementFilters(qs)).toEqual(filters);
    expect(parseSettlementSort(qs)).toEqual(sort);
  });

  it("omits defaults and trims/limits the search", () => {
    expect(settlementFilterParams(DEFAULT_SETTLEMENT_FILTERS, DEFAULT_SETTLEMENT_SORT)).toEqual({
      q: null,
      range: null,
      from: null,
      to: null,
      sort: null,
    });
    expect(parseSettlementFilters(q(`q=${"x".repeat(150)}`)).q).toHaveLength(100);
    expect(parseSettlementFilters(q("q=%20%20tiles%20")).q).toBe("tiles");
  });

  it("rejects unknown sort columns", () => {
    expect(parseSettlementSort(q("sort=evil.desc"))).toEqual(DEFAULT_SETTLEMENT_SORT);
  });
});

describe("filterSettlements → summarizeSettlements", () => {
  it("searches paid to, description and mode, case-insensitively", () => {
    expect(ids(filterSettlements(ROWS, { ...DEFAULT_SETTLEMENT_FILTERS, q: "TILES" }, NOW))).toEqual(["a", "c"]);
    expect(ids(filterSettlements(ROWS, { ...DEFAULT_SETTLEMENT_FILTERS, q: "cash" }, NOW))).toEqual(["b"]);
  });

  it("filters by date range", () => {
    const rows = filterSettlements(
      ROWS,
      { ...DEFAULT_SETTLEMENT_FILTERS, range: { preset: "this-month", from: null, to: null } },
      NOW,
    );
    expect(ids(rows)).toEqual(["b", "c"]);
  });

  it("totals the filtered rows exactly", () => {
    const rows = filterSettlements(
      ROWS,
      { ...DEFAULT_SETTLEMENT_FILTERS, range: { preset: "this-month", from: null, to: null } },
      NOW,
    );
    expect(summarizeSettlements(rows)).toEqual({ count: 2, total: 1200.55 });
    expect(summarizeSettlements([])).toEqual({ count: 0, total: 0 });
  });

  it("knows when filters are active", () => {
    expect(hasActiveSettlementFilters(DEFAULT_SETTLEMENT_FILTERS)).toBe(false);
    expect(hasActiveSettlementFilters({ ...DEFAULT_SETTLEMENT_FILTERS, q: "x" })).toBe(true);
  });
});

describe("settlementsCsv", () => {
  it("exports rows with escaped text and plain-number amounts", () => {
    const csv = settlementsCsv(
      [
        settlement({
          id: "a",
          date: "2026-10-03",
          paidTo: "Sri Electricals",
          description: 'Wiring, 2" conduit',
          mode: "Cash",
          amount: 1200.45,
          proofUrl: "https://signed",
          createdByName: "Asha",
        }),
      ],
      { id: "u1", name: "Kalyan" },
    );
    expect(csv).toBe(
      UTF8_BOM +
        "Date,Paid to,Description,Mode,Amount (₹),Proof,Created by\r\n" +
        '2026-10-03,Sri Electricals,"Wiring, 2"" conduit",Cash,1200.45,Attached,Asha\r\n',
    );
  });
});
