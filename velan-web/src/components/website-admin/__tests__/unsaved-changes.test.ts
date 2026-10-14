import { describe, expect, it } from "vitest";
import { shouldConfirmLinkNavigation } from "../unsaved-changes";

const HERE = "https://app.velanspaces.com/app/website/abc";

function click(overrides: Partial<Parameters<typeof shouldConfirmLinkNavigation>[0]> = {}) {
  return {
    href: "https://app.velanspaces.com/app/projects",
    target: "",
    download: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
  };
}

describe("shouldConfirmLinkNavigation", () => {
  it("asks before following an in-app link to another page", () => {
    expect(shouldConfirmLinkNavigation(click(), HERE)).toBe(true);
  });

  it("asks before a same-path link with a different query", () => {
    expect(shouldConfirmLinkNavigation(click({ href: `${HERE}?tab=2` }), HERE)).toBe(true);
  });

  it("does not ask for in-page hash links", () => {
    expect(shouldConfirmLinkNavigation(click({ href: `${HERE}#photos` }), HERE)).toBe(false);
  });

  it("does not ask for links that open a new tab or download", () => {
    expect(shouldConfirmLinkNavigation(click({ target: "_blank" }), HERE)).toBe(false);
    expect(shouldConfirmLinkNavigation(click({ download: true }), HERE)).toBe(false);
  });

  it("does not ask for modified or non-primary clicks (new tab/window)", () => {
    expect(shouldConfirmLinkNavigation(click({ metaKey: true }), HERE)).toBe(false);
    expect(shouldConfirmLinkNavigation(click({ ctrlKey: true }), HERE)).toBe(false);
    expect(shouldConfirmLinkNavigation(click({ shiftKey: true }), HERE)).toBe(false);
    expect(shouldConfirmLinkNavigation(click({ button: 1 }), HERE)).toBe(false);
  });

  it("leaves other origins to the beforeunload prompt", () => {
    expect(shouldConfirmLinkNavigation(click({ href: "https://wa.me/123" }), HERE)).toBe(false);
    expect(shouldConfirmLinkNavigation(click({ href: "mailto:a@b.c" }), HERE)).toBe(false);
  });

  it("ignores clicks something else already handled", () => {
    expect(shouldConfirmLinkNavigation(click({ defaultPrevented: true }), HERE)).toBe(false);
  });

  it("ignores missing or malformed hrefs", () => {
    expect(shouldConfirmLinkNavigation(click({ href: "" }), HERE)).toBe(false);
    expect(shouldConfirmLinkNavigation(click({ href: "http://[" }), HERE)).toBe(false);
  });
});
