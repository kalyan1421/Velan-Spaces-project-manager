import { formatQuoteNumber, quotePdfFileName, quoteYear } from './quote-number';

describe('formatQuoteNumber', () => {
  it('formats <prefix>-<YYYY>-<4-digit seq>', () => {
    expect(formatQuoteNumber('VS', 2026, 7)).toBe('VS-2026-0007');
  });

  it('does not double a trailing dash (default prefix is "QUO-")', () => {
    expect(formatQuoteNumber('QUO-', 2026, 1)).toBe('QUO-2026-0001');
    expect(formatQuoteNumber('QUO--', 2026, 12)).toBe('QUO-2026-0012');
  });

  it('falls back to QUO for an empty prefix', () => {
    expect(formatQuoteNumber('', 2027, 3)).toBe('QUO-2027-0003');
    expect(formatQuoteNumber(null, 2027, 3)).toBe('QUO-2027-0003');
    expect(formatQuoteNumber('  ', 2027, 3)).toBe('QUO-2027-0003');
  });

  it('keeps sequences past 9999 intact', () => {
    expect(formatQuoteNumber('QUO-', 2026, 12345)).toBe('QUO-2026-12345');
  });
});

describe('quoteYear', () => {
  it('uses the IST calendar year (new year starts at 18:30 UTC on 31 Dec)', () => {
    expect(quoteYear(new Date('2026-12-31T18:29:59Z'))).toBe(2026);
    expect(quoteYear(new Date('2026-12-31T18:30:00Z'))).toBe(2027);
  });
});

describe('quotePdfFileName', () => {
  it('uses the quote number and strips unsafe characters', () => {
    expect(quotePdfFileName('QUO-2026-0007')).toBe('QUO-2026-0007.pdf');
    expect(quotePdfFileName('A/B "x"')).toBe('A_B__x_.pdf');
    expect(quotePdfFileName(null)).toBe('quotation.pdf');
  });
});
