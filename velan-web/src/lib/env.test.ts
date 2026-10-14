import { describe, expect, it } from "vitest";
import { ENV_VARS, parseEnv } from "./env";

describe("parseEnv", () => {
  it("applies defaults for local development", () => {
    const env = parseEnv({});
    expect(env.API_URL).toBe("http://localhost:3000/api/v1");
    expect(env.APP_URL).toBe("http://localhost:3100");
    expect(env.NEXT_PUBLIC_GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("strips trailing slashes from URLs", () => {
    const env = parseEnv({ API_URL: "http://api:3000/api/v1/", APP_URL: "https://app.velanspaces.com/" });
    expect(env.API_URL).toBe("http://api:3000/api/v1");
    expect(env.APP_URL).toBe("https://app.velanspaces.com");
  });

  it("treats blank optional values as unset", () => {
    expect(parseEnv({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "  " }).NEXT_PUBLIC_GOOGLE_CLIENT_ID).toBeUndefined();
    expect(parseEnv({ API_URL: "" }).API_URL).toBe("http://localhost:3000/api/v1");
  });

  it("rejects non-http URLs", () => {
    expect(() => parseEnv({ API_URL: "ftp://api" })).toThrow(/API_URL/);
    expect(() => parseEnv({ APP_URL: "not a url" })).toThrow(/APP_URL/);
  });

  it("documents every variable it reads", () => {
    expect(ENV_VARS.map((v) => v.name).sort()).toEqual(
      ["API_URL", "APP_URL", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"].sort(),
    );
  });
});
