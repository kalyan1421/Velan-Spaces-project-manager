/**
 * One error type for every API failure, on the server and in the browser.
 * The API's envelope is `{ statusCode, message, error?, details? }` where
 * `message` may be a string or a string[] (class-validator).
 */

const FALLBACK_MESSAGES: Record<number, string> = {
  0: "We couldn't reach the server. Check your connection and try again.",
  400: "The request was invalid. Please check the form and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That conflicts with existing data. Refresh and try again.",
  413: "That file is too large.",
  422: "Some of the details are invalid. Please check and try again.",
  429: "Too many attempts. Please wait a minute and try again.",
};

const SERVER_ERROR = "Something went wrong on our side. Please try again in a moment.";

export function fallbackMessage(status: number): string {
  if (status >= 500) return SERVER_ERROR;
  return FALLBACK_MESSAGES[status] ?? FALLBACK_MESSAGES[400];
}

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string | string[],
    options: { code?: string; details?: unknown } = {},
  ) {
    const messages = (Array.isArray(message) ? message : [message])
      .map((m) => (typeof m === "string" ? m.trim() : ""))
      .filter(Boolean);
    const finalMessages = messages.length > 0 ? messages : [fallbackMessage(status)];
    super(finalMessages.join("; "));
    this.name = "ApiError";
    this.status = status;
    this.messages = finalMessages;
    this.code = options.code;
    this.details = options.details;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Builds an ApiError from a parsed (or raw text) error body. 5xx text never reaches users. */
export function apiErrorFromBody(status: number, body: unknown): ApiError {
  if (status >= 500) return new ApiError(status, SERVER_ERROR);

  if (typeof body === "string") return new ApiError(status, body);

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const b = body as Record<string, unknown>;
    const raw = b.message;
    const message =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.filter((m): m is string => typeof m === "string")
          : "";
    return new ApiError(status, message, {
      code: typeof b.error === "string" ? b.error : undefined,
      details: b.details,
    });
  }

  return new ApiError(status, "");
}

/** Reads a fetch Response body as JSON when possible, else text. Never throws. */
export async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}
