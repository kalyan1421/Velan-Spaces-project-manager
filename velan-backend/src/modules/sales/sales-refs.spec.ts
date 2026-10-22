import { isAllowedLegacyImageUrl, normalizeQuotationRef } from './sales-refs';

const BASES = ['http://127.0.0.1:54321'];

describe('normalizeQuotationRef', () => {
  it('accepts quotation refs and canonicalises our signed URLs', () => {
    expect(normalizeQuotationRef('sb://quotations/quotation/settings/logo.png', BASES)).toEqual({
      ok: true,
      value: 'sb://quotations/quotation/settings/logo.png',
    });
    expect(
      normalizeQuotationRef(
        'http://127.0.0.1:54321/storage/v1/object/sign/quotations/quotation/sent/QUO-2026-0001.pdf?token=abc',
        BASES,
      ),
    ).toEqual({ ok: true, value: 'sb://quotations/quotation/sent/QUO-2026-0001.pdf' });
  });

  it('clears on empty values', () => {
    expect(normalizeQuotationRef('', BASES)).toEqual({ ok: true, value: null });
    expect(normalizeQuotationRef(null, BASES)).toEqual({ ok: true, value: null });
  });

  it('keeps legacy https URLs as-is', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/logo.png?alt=media';
    expect(normalizeQuotationRef(url, BASES)).toEqual({ ok: true, value: url });
  });

  it.each([
    ['sb://project-files/projects/6f1c2f5e-3c1b-4d55-9a31-0d9f1f0b7a11/a.png', 'other bucket'],
    ['sb://quotations/other/a.png', 'outside quotation/'],
    ['sb://quotations/quotation/../x.png', 'traversal'],
    ['sb://quotations', 'malformed'],
    ['http://evil.example/logo.png', 'plain http'],
    ['javascript:alert(1)', 'not a URL'],
  ])('rejects %s (%s)', (value) => {
    expect(normalizeQuotationRef(value, BASES).ok).toBe(false);
  });
});

describe('isAllowedLegacyImageUrl', () => {
  it('only allows Firebase/Google storage over https', () => {
    expect(isAllowedLegacyImageUrl('https://firebasestorage.googleapis.com/v0/b/x/o/a.png')).toBe(true);
    expect(isAllowedLegacyImageUrl('http://firebasestorage.googleapis.com/a.png')).toBe(false);
    expect(isAllowedLegacyImageUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedLegacyImageUrl('not a url')).toBe(false);
  });
});
