import { describe, expect, it } from "vitest";
import {
  ALL_DATES,
  dateRangeParams,
  describeDateRange,
  inDateRange,
  parseDateRange,
  resolveDateRange,
} from "./date-range";

// 14 Oct 2026, 10:00 IST
const NOW = new Date("2026-10-14T04:30:00Z");
const params = (q: string) => new URLSearchParams(q);

describe("resolveDateRange presets", () => {
  it("all dates has no bounds", () => {
    expect(resolveDateRange(ALL_DATES, NOW)).toEqual({ from: null, to: null });
  });

  it("this month runs from the 1st to the last day", () => {
    expect(resolveDateRange({ preset: "this-month", from: null, to: null }, NOW)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("last month handles the year boundary", () => {
    const jan = new Date("2026-01-10T04:30:00Z");
    expect(resolveDateRange({ preset: "last-month", from: null, to: null }, jan)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("last month ends on the right day in February of a leap year", () => {
    const march = new Date("2028-03-05T04:30:00Z");
    expect(resolveDateRange({ preset: "last-month", from: null, to: null }, march)).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("last 30 / 90 days include today", () => {
    expect(resolveDateRange({ preset: "last-30-days", from: null, to: null }, NOW)).toEqual({
      from: "2026-09-15",
      to: "2026-10-14",
    });
    expect(resolveDateRange({ preset: "last-90-days", from: null, to: null }, NOW)).toEqual({
      from: "2026-07-17",
      to: "2026-10-14",
    });
  });

  it("uses the Indian financial year (1 Apr – 31 Mar)", () => {
    expect(resolveDateRange({ preset: "this-fy", from: null, to: null }, NOW)).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
    });
    expect(resolveDateRange({ preset: "last-fy", from: null, to: null }, NOW)).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    });
    const feb = new Date("2027-02-01T04:30:00Z");
    expect(resolveDateRange({ preset: "this-fy", from: null, to: null }, feb)).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
    });
  });

  it("computes 'today' in IST, not UTC", () => {
    // 31 Oct 2026 20:00 UTC is already 1 Nov in India.
    const lateUtc = new Date("2026-10-31T20:00:00Z");
    expect(resolveDateRange({ preset: "this-month", from: null, to: null }, lateUtc).from).toBe("2026-11-01");
  });

  it("custom ranges may be open on either side", () => {
    expect(resolveDateRange({ preset: "custom", from: "2026-10-01", to: null }, NOW)).toEqual({
      from: "2026-10-01",
      to: null,
    });
  });
});

describe("parseDateRange (URL)", () => {
  it("defaults to all dates", () => {
    expect(parseDateRange(params(""))).toEqual(ALL_DATES);
    expect(parseDateRange(params("range=bogus"))).toEqual(ALL_DATES);
  });

  it("reads a preset and ignores stray from/to", () => {
    expect(parseDateRange(params("range=this-fy&from=2026-01-01"))).toEqual({
      preset: "this-fy",
      from: null,
      to: null,
    });
  });

  it("reads a custom range and swaps reversed bounds", () => {
    expect(parseDateRange(params("range=custom&from=2026-10-31&to=2026-10-01"))).toEqual({
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("treats from/to without a range as custom and drops invalid dates", () => {
    expect(parseDateRange(params("from=2026-10-01&to=2026-02-30"))).toEqual({
      preset: "custom",
      from: "2026-10-01",
      to: null,
    });
    expect(parseDateRange(params("from=nope"))).toEqual(ALL_DATES);
  });

  it("keeps an empty custom range so the date inputs stay open", () => {
    expect(parseDateRange(params("range=custom&from=nope"))).toEqual({ preset: "custom", from: null, to: null });
  });
});

describe("dateRangeParams", () => {
  it("omits defaults and round-trips", () => {
    expect(dateRangeParams(ALL_DATES)).toEqual({ range: null, from: null, to: null });
    expect(dateRangeParams({ preset: "custom", from: null, to: null })).toEqual({ range: "custom", from: null, to: null });
    expect(dateRangeParams({ preset: "this-fy", from: "2026-01-01", to: null })).toEqual({ range: "this-fy", from: null, to: null });
    const custom = { preset: "custom" as const, from: "2026-10-01", to: "2026-10-31" };
    const p = dateRangeParams(custom);
    expect(p).toEqual({ range: "custom", from: "2026-10-01", to: "2026-10-31" });
    const qs = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => e[1] !== null));
    expect(parseDateRange(qs)).toEqual(custom);
  });
});

describe("inDateRange", () => {
  const bounds = { from: "2026-10-01", to: "2026-10-31" };
  it("is inclusive on both ends", () => {
    expect(inDateRange("2026-10-01", bounds)).toBe(true);
    expect(inDateRange("2026-10-31", bounds)).toBe(true);
    expect(inDateRange("2026-09-30", bounds)).toBe(false);
    expect(inDateRange("2026-11-01", bounds)).toBe(false);
  });

  it("keeps undated rows only when no bound is set", () => {
    expect(inDateRange("", { from: null, to: null })).toBe(true);
    expect(inDateRange("", bounds)).toBe(false);
  });
});

describe("describeDateRange", () => {
  it("names presets and formats custom ranges the Indian way", () => {
    expect(describeDateRange(ALL_DATES, NOW)).toBe("All dates");
    expect(describeDateRange({ preset: "this-month", from: null, to: null }, NOW)).toBe(
      "This month (01 Oct 2026 – 31 Oct 2026)",
    );
    expect(describeDateRange({ preset: "custom", from: "2026-10-01", to: null }, NOW)).toBe("From 01 Oct 2026");
    expect(describeDateRange({ preset: "custom", from: null, to: "2026-10-05" }, NOW)).toBe("Up to 05 Oct 2026");
  });
});
