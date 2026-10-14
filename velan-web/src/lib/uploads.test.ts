import { describe, expect, it } from "vitest";
import { buildProjectObjectPath, extensionOf, isAllowedFile, safeFileName, toStorageRef } from "./uploads";

const PID = "5b91891e-1c5c-4f50-a8dc-f57c56d1458c";

describe("uploads helpers", () => {
  it("extracts lowercase extensions", () => {
    expect(extensionOf("Photo.JPG")).toBe("jpg");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf(".env")).toBe("");
    expect(extensionOf("README")).toBe("");
  });

  it("allows only the API's extension list", () => {
    expect(isAllowedFile("plan.pdf")).toBe(true);
    expect(isAllowedFile("site.MOV")).toBe(true);
    expect(isAllowedFile("virus.exe")).toBe(false);
    expect(isAllowedFile("noext")).toBe(false);
  });

  it("makes safe file names", () => {
    expect(safeFileName("My Photo (1).JPG")).toBe("my-photo-1.jpg");
    expect(safeFileName("Café Plan.pdf")).toBe("cafe-plan.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("😀.png")).toBe("file.png");
  });

  it("builds project-scoped paths the API accepts", () => {
    const path = buildProjectObjectPath(PID, "Updates", "Site Photo.jpeg", "abc12345");
    expect(path).toBe(`projects/${PID}/updates/abc12345-site-photo.jpeg`);
    expect(path.split("/")).not.toContain("..");
    expect(() => buildProjectObjectPath(PID, "///", "a.jpg")).toThrow();
  });

  it("formats storage refs", () => {
    expect(toStorageRef("designs", `projects/${PID}/designs/x.pdf`)).toBe(`sb://designs/projects/${PID}/designs/x.pdf`);
  });
});
