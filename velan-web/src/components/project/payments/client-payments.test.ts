import { describe, expect, it } from "vitest";
import { normalizeClientPayments, paymentStanding } from "./client-payments";

describe("normalizeClientPayments", () => {
  it("reads the API shape", () => {
    expect(
      normalizeClientPayments({
        budget: 1500000,
        received: "500000",
        balance: 1000000,
        receivedPercent: 33.33,
        payments: [
          { id: "p1", amount: "300000.00", date: "2026-10-01", paymentMethod: "UPI" },
          { id: "p2", amount: 200000, date: null, paymentMethod: "" },
          { amount: 5 },
        ],
      }),
    ).toEqual({
      budget: 1500000,
      received: 500000,
      balance: 1000000,
      receivedPercent: 33.33,
      payments: [
        { id: "p1", amount: 300000, date: "2026-10-01", paymentMethod: "UPI" },
        { id: "p2", amount: 200000, date: null, paymentMethod: null },
      ],
    });
  });

  it("keeps a missing percent as null and clamps the rest", () => {
    expect(normalizeClientPayments({ budget: 0, receivedPercent: null }).receivedPercent).toBeNull();
    expect(normalizeClientPayments({ receivedPercent: 140 }).receivedPercent).toBe(100);
    expect(normalizeClientPayments(null)).toEqual({ budget: 0, received: 0, balance: 0, receivedPercent: null, payments: [] });
  });
});

describe("paymentStanding", () => {
  it("covers every state", () => {
    expect(paymentStanding({ budget: 0, received: 100, balance: -100 })).toEqual({ kind: "no-budget" });
    expect(paymentStanding({ budget: 1000, received: 0, balance: 1000 })).toEqual({ kind: "not-started" });
    expect(paymentStanding({ budget: 1000, received: 400, balance: 600 })).toEqual({ kind: "partial", due: 600 });
    expect(paymentStanding({ budget: 1000, received: 1000, balance: 0 })).toEqual({ kind: "paid" });
    expect(paymentStanding({ budget: 1000, received: 1200, balance: -200 })).toEqual({ kind: "ahead", ahead: 200 });
  });
});
