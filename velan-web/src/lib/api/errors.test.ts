import { describe, expect, it } from "vitest";
import { ApiError, apiErrorFromBody, isApiError } from "./errors";

describe("apiErrorFromBody", () => {
  it("keeps a string message", () => {
    const err = apiErrorFromBody(404, { statusCode: 404, message: "Project not found", error: "Not Found" });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("Project not found");
    expect(err.messages).toEqual(["Project not found"]);
    expect(err.code).toBe("Not Found");
  });

  it("joins validation message arrays", () => {
    const err = apiErrorFromBody(400, {
      statusCode: 400,
      message: ["email must be an email", "password should not be empty"],
    });
    expect(err.messages).toEqual(["email must be an email", "password should not be empty"]);
    expect(err.message).toBe("email must be an email; password should not be empty");
  });

  it("uses a friendly fallback when the body has no message", () => {
    expect(apiErrorFromBody(429, null).message).toMatch(/too many/i);
    expect(apiErrorFromBody(403, {}).message).toMatch(/permission/i);
    expect(apiErrorFromBody(401, "").message).toMatch(/sign in/i);
  });

  it("hides server internals on 5xx", () => {
    const err = apiErrorFromBody(500, { statusCode: 500, message: 'relation "users" does not exist' });
    expect(err.message).not.toMatch(/relation/);
    expect(err.message).toMatch(/something went wrong/i);
  });

  it("accepts a plain-text body", () => {
    expect(apiErrorFromBody(409, "Code already in use").message).toBe("Code already in use");
  });

  it("ignores blank strings inside message arrays", () => {
    expect(apiErrorFromBody(400, { message: ["", "  "] }).message).toMatch(/invalid/i);
  });

  it("carries details through", () => {
    const err = apiErrorFromBody(422, { message: "Invalid", details: { field: "name" } });
    expect(err.details).toEqual({ field: "name" });
  });
});

describe("isApiError", () => {
  it("narrows ApiError instances only", () => {
    expect(isApiError(new ApiError(400, "x"))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError({ status: 400, message: "x" })).toBe(false);
  });
});
