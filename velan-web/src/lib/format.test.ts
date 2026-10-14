import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatINR,
  formatINRCompact,
  formatPercent,
  formatRelative,
  toNumber,
} from "./format";

describe("toNumber", () => {
  it("passes finite numbers through", () => {
    expect(toNumber(1500000)).toBe(1500000);
  });

  it("parses Postgres numeric strings", () => {
    expect(toNumber("1500000.00")).toBe(1500000);
  });

  it("tolerates grouping commas and whitespace", () => {
    expect(toNumber(" 15,00,000 ")).toBe(1500000);
  });

  it("falls back for null, undefined, empty and garbage", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
  });

  it("uses the provided fallback", () => {
    expect(toNumber("abc", -1)).toBe(-1);
  });
});

describe("formatINR", () => {
  it("uses lakh/crore grouping with the rupee sign", () => {
    expect(formatINR(1500000)).toBe("₹15,00,000");
    expect(formatINR(12345678)).toBe("₹1,23,45,678");
  });

  it("accepts numeric strings", () => {
    expect(formatINR("250000.00")).toBe("₹2,50,000");
  });

  it("shows paise only when present", () => {
    expect(formatINR(1234.5)).toBe("₹1,234.50");
  });

  it("formats zero and negatives", () => {
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-5000)).toBe("-₹5,000");
  });
});

describe("formatINRCompact", () => {
  it("uses lakhs between 1 L and 1 Cr", () => {
    expect(formatINRCompact(1500000)).toBe("₹15 L");
    expect(formatINRCompact(1550000)).toBe("₹15.5 L");
  });

  it("uses crores from 1 Cr", () => {
    expect(formatINRCompact(12000000)).toBe("₹1.2 Cr");
    expect(formatINRCompact(125000000)).toBe("₹12.5 Cr");
  });

  it("rolls a rounded 100 L over to crores", () => {
    expect(formatINRCompact(9999999)).toBe("₹1 Cr");
  });

  it("falls back to full formatting under a lakh", () => {
    expect(formatINRCompact(45000)).toBe("₹45,000");
  });

  it("keeps the sign for negatives", () => {
    expect(formatINRCompact(-1500000)).toBe("-₹15 L");
  });

  it("accepts numeric strings", () => {
    expect(formatINRCompact("12000000.00")).toBe("₹1.2 Cr");
  });
});

describe("formatDate", () => {
  it("formats ISO timestamps as DD MMM YYYY in IST", () => {
    // 20:00 UTC is already the next day in Asia/Kolkata (UTC+5:30).
    expect(formatDate("2026-10-14T20:00:00Z")).toBe("15 Oct 2026");
  });

  it("formats date-only strings without shifting the day", () => {
    expect(formatDate("2026-09-03")).toBe("03 Sep 2026");
  });

  it("accepts Date objects", () => {
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe("01 Jan 2026");
  });

  it("returns a dash for empty or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("adds a 12-hour IST time", () => {
    expect(formatDateTime("2026-10-14T09:30:00Z")).toBe("14 Oct 2026, 3:00 PM");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-10-14T12:00:00Z");

  it("says just now for the last minute", () => {
    expect(formatRelative("2026-10-14T11:59:30Z", now)).toBe("just now");
  });

  it("uses minutes and hours", () => {
    expect(formatRelative("2026-10-14T11:55:00Z", now)).toBe("5 minutes ago");
    expect(formatRelative("2026-10-14T09:00:00Z", now)).toBe("3 hours ago");
  });

  it("uses days within a month", () => {
    expect(formatRelative("2026-10-13T12:00:00Z", now)).toBe("yesterday");
    expect(formatRelative("2026-10-10T12:00:00Z", now)).toBe("4 days ago");
  });

  it("falls back to the date after 30 days", () => {
    expect(formatRelative("2026-08-01T12:00:00Z", now)).toBe("01 Aug 2026");
  });

  it("returns a dash for invalid input", () => {
    expect(formatRelative(null, now)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("clamps and rounds to a whole percent", () => {
    expect(formatPercent(42.6)).toBe("43%");
    expect(formatPercent(140)).toBe("100%");
    expect(formatPercent(-3)).toBe("0%");
    expect(formatPercent("55")).toBe("55%");
  });
});
