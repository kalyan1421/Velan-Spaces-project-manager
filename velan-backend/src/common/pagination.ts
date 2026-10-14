/**
 * Safe pagination parsing. Query-string values are untrusted: `Number('abc')`
 * is NaN, negatives and huge values would otherwise reach the database layer
 * (NaN -> 500 with a leaked message; huge -> expensive scans).
 */
export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(
  limit?: string | number,
  offset?: string | number,
  opts: { defaultLimit?: number; maxLimit?: number } = {},
): Pagination {
  const defaultLimit = opts.defaultLimit ?? 50;
  const maxLimit = opts.maxLimit ?? 100;

  const l = Number(limit);
  const o = Number(offset);

  const safeLimit =
    limit === undefined || limit === '' || !Number.isFinite(l) || l < 1
      ? defaultLimit
      : Math.min(Math.floor(l), maxLimit);
  const safeOffset =
    offset === undefined || offset === '' || !Number.isFinite(o) || o < 0
      ? 0
      : Math.floor(o);

  return { limit: safeLimit, offset: safeOffset };
}
