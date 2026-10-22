import { describe, expect, it } from "vitest";
import { PORTAL_SECTIONS, activePortalSection, portalChatHref, portalSectionHref } from "./portal-sections";

const PID = "5b91891e-1c5c-4f50-a8dc-f57c56d1458c";

describe("portal sections", () => {
  it("includes Files and never a money section", () => {
    expect(PORTAL_SECTIONS.map((s) => s.segment)).toEqual(["", "updates", "designs", "files", "timeline"]);
    expect(PORTAL_SECTIONS.some((s) => /budget|spend|settle/i.test(s.segment + s.label))).toBe(false);
  });

  it("builds hrefs", () => {
    expect(portalSectionHref(PID, "")).toBe(`/portal/projects/${PID}`);
    expect(portalSectionHref(PID, "files")).toBe(`/portal/projects/${PID}/files`);
    expect(portalChatHref(PID)).toBe(`/portal/projects/${PID}#chat`);
  });

  it("has no support section (chat is a box on the overview)", () => {
    expect(PORTAL_SECTIONS.some((s) => /support/i.test(s.label))).toBe(false);
    expect(activePortalSection(`/portal/projects/${PID}/support`, PID)).toBeNull();
  });

  it("finds the active section, including nested paths", () => {
    expect(activePortalSection(`/portal/projects/${PID}`, PID)?.label).toBe("Overview");
    expect(activePortalSection(`/portal/projects/${PID}/files`, PID)?.label).toBe("Files");
    expect(activePortalSection(`/portal/projects/${PID}/designs/extra`, PID)?.label).toBe("Designs");
  });

  it("returns null for unknown sections and other projects", () => {
    expect(activePortalSection(`/portal/projects/${PID}/budget`, PID)).toBeNull();
    expect(activePortalSection(`/portal/projects/other/files`, PID)).toBeNull();
    expect(activePortalSection(`/portal`, PID)).toBeNull();
  });
});
