/**
 * Response key casing. The database uses snake_case columns; the API contract
 * (and the Flutter app, whose models mirror the old Firestore field names) is
 * camelCase. Converting once at the edge keeps services working with raw rows.
 */
export function snakeToCamel(key: string): string {
  // Leading underscores (e.g. "_meta") are kept as-is.
  // Lookbehind (not a capture) so adjacent segments like `line_2_total` all convert.
  return key.replace(/(?<=[a-z0-9])_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Deep-converts object keys to camelCase. Values (strings, dates, …) are untouched. */
export function camelizeKeys<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (!isPlainObject(value)) return value as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[snakeToCamel(k)] = camelizeKeys(v);
  }
  return out as T;
}
