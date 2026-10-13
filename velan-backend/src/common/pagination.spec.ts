import { parsePagination } from './pagination';

describe('parsePagination', () => {
  it('uses defaults when nothing is supplied', () => {
    expect(parsePagination()).toEqual({ limit: 50, offset: 0 });
  });

  it('accepts valid numeric strings', () => {
    expect(parsePagination('20', '40')).toEqual({ limit: 20, offset: 40 });
  });

  it('falls back to defaults for NaN / garbage', () => {
    expect(parsePagination('abc', 'xyz')).toEqual({ limit: 50, offset: 0 });
    expect(parsePagination('', '')).toEqual({ limit: 50, offset: 0 });
  });

  it('clamps limit to the maximum and rejects non-positive limits', () => {
    expect(parsePagination('100000').limit).toBe(100);
    expect(parsePagination('0').limit).toBe(50);
    expect(parsePagination('-5').limit).toBe(50);
  });

  it('never returns a negative offset', () => {
    expect(parsePagination('10', '-3').offset).toBe(0);
  });

  it('floors fractional values', () => {
    expect(parsePagination('10.9', '3.7')).toEqual({ limit: 10, offset: 3 });
  });

  it('respects custom bounds', () => {
    expect(parsePagination('500', '0', { maxLimit: 200 }).limit).toBe(200);
    expect(parsePagination(undefined, undefined, { defaultLimit: 25 }).limit).toBe(25);
  });
});
