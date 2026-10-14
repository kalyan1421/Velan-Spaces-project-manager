import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  accessCookieMaxAge,
  sessionCookieOptions,
} from "./cookies";

describe("cookie names", () => {
  it("matches the plan", () => {
    expect(ACCESS_COOKIE).toBe("vs_at");
    expect(REFRESH_COOKIE).toBe("vs_rt");
  });
});

describe("accessCookieMaxAge", () => {
  const now = 1_800_000_000;

  it("expires a minute before the token so the refresh happens first", () => {
    expect(accessCookieMaxAge(now + 3600, now)).toBe(3540);
  });

  it("is zero for tokens that are about to expire or already have", () => {
    expect(accessCookieMaxAge(now + 30, now)).toBe(0);
    expect(accessCookieMaxAge(now - 10, now)).toBe(0);
  });

  it("is zero for nonsense expiry values", () => {
    expect(accessCookieMaxAge(Number.NaN, now)).toBe(0);
  });

  it("never outlives the refresh cookie", () => {
    expect(accessCookieMaxAge(now + REFRESH_MAX_AGE * 2, now)).toBe(REFRESH_MAX_AGE);
  });
});

describe("sessionCookieOptions", () => {
  it("is HttpOnly, Lax and site-wide", () => {
    expect(sessionCookieOptions(60, false)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
      maxAge: 60,
    });
  });

  it("is Secure when asked", () => {
    expect(sessionCookieOptions(60, true).secure).toBe(true);
  });
});
