/** Per-test fake client IPs (see support/test.ts for why). Kept free of Playwright imports for global setup. */
const RUN_NONCE = Date.now();

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A private-range IP unique to this test (and run), e.g. 10.23.181.7. */
export function clientIpFor(key: string): string {
  const h = hash(`${RUN_NONCE}:${key}`);
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}
