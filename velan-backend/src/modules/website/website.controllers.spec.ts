import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PortfolioController } from './portfolio.controller';
import { PUBLIC_CACHE_CONTROL, WebsitePublicController } from './website-public.controller';

/** Pins the security wiring: who can call what, and what gets cached. */
describe('website controllers — access wiring', () => {
  it('public website controller is @Public (no bearer token needed)', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, WebsitePublicController)).toBe(true);
  });

  it('portfolio admin controller is head-only and NOT public', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PortfolioController)).toEqual(['head']);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PortfolioController)).toBeUndefined();
    for (const handler of ['list', 'create', 'reorder', 'signUpload', 'update', 'remove'] as const) {
      const fn = PortfolioController.prototype[handler];
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, fn)).toBeUndefined();
      expect(Reflect.getMetadata(ROLES_KEY, fn)).toBeUndefined(); // class-level 'head' applies
    }
  });

  it('enquiries are throttled to 5 per minute', () => {
    const fn = WebsitePublicController.prototype.submit;
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', fn)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', fn)).toBe(60_000);
  });
});

describe('WebsitePublicController — caching', () => {
  const item = { id: '1', slug: 'a' };
  const fakeRes = () => {
    const headers: Record<string, string> = {};
    return { headers, setHeader: (k: string, v: string) => (headers[k] = v) };
  };

  it('sets Cache-Control on a successful list and passes the category through', async () => {
    const listPublic = jest.fn().mockResolvedValue([item]);
    const ctrl = new WebsitePublicController({ listPublic } as never, {} as never);
    const res = fakeRes();
    await expect(ctrl.list('Kitchen', res as never)).resolves.toEqual([item]);
    expect(listPublic).toHaveBeenCalledWith('kitchen');
    expect(res.headers['Cache-Control']).toBe(PUBLIC_CACHE_CONTROL);
    expect(PUBLIC_CACHE_CONTROL).toBe('public, max-age=60, s-maxage=300');
  });

  it('400s an unknown category without caching the error', async () => {
    const listPublic = jest.fn();
    const ctrl = new WebsitePublicController({ listPublic } as never, {} as never);
    const res = fakeRes();
    await expect(ctrl.list('villa', res as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(listPublic).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBeUndefined();
  });

  it('does not cache a 404', async () => {
    const getPublicBySlug = jest.fn().mockRejectedValue(new NotFoundException());
    const ctrl = new WebsitePublicController({ getPublicBySlug } as never, {} as never);
    const res = fakeRes();
    await expect(ctrl.get('missing', res as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(res.headers['Cache-Control']).toBeUndefined();
  });

  it('caches a found item', async () => {
    const getPublicBySlug = jest.fn().mockResolvedValue(item);
    const ctrl = new WebsitePublicController({ getPublicBySlug } as never, {} as never);
    const res = fakeRes();
    await expect(ctrl.get('a', res as never)).resolves.toEqual(item);
    expect(res.headers['Cache-Control']).toBe(PUBLIC_CACHE_CONTROL);
  });
});
