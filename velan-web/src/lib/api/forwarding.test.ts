import { describe, expect, it } from "vitest";
import { forwardedFor } from "./forwarding";

describe("forwardedFor", () => {
  it("passes an existing X-Forwarded-For chain through", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" });
    expect(forwardedFor(h)).toBe("203.0.113.7, 10.0.0.2");
  });

  it("falls back to X-Real-IP", () => {
    expect(forwardedFor(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("returns null when nothing usable is present", () => {
    expect(forwardedFor(new Headers())).toBeNull();
  });

  it("drops values with characters that are not part of IP lists", () => {
    expect(forwardedFor(new Headers({ "x-forwarded-for": "1.2.3.4; evil=1" }))).toBeNull();
    expect(forwardedFor(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
  });

  it("caps very long chains", () => {
    const chain = Array.from({ length: 100 }, () => "203.0.113.7").join(", ");
    expect(forwardedFor(new Headers({ "x-forwarded-for": chain }))).toBeNull();
  });
});
