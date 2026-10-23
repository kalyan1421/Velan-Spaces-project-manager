import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { envSchema } from '../../config/env.validation';
import { AppVersionController } from './app-version.controller';
import { PUBLIC_CACHE_CONTROL } from './website-public.controller';

const baseEnv = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'a',
  SUPABASE_SERVICE_ROLE_KEY: 's',
};

describe('AppVersionController', () => {
  const make = (vals: Record<string, string>) =>
    new AppVersionController({ get: (k: string) => vals[k] } as never);
  const fakeRes = () => {
    const headers: Record<string, string> = {};
    return { headers, setHeader: (k: string, v: string) => (headers[k] = v) };
  };

  it('is public and throttled', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AppVersionController)).toBe(true);
    const fn = AppVersionController.prototype.get;
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', fn)).toBe(60);
  });

  it('returns the configured minVersion and message, cacheable', () => {
    const res = fakeRes();
    const out = make({ MIN_APP_VERSION: '1.4.0', MIN_APP_MESSAGE: 'Update now' }).get(res as never);
    expect(out).toEqual({ minVersion: '1.4.0', message: 'Update now' });
    expect(res.headers['Cache-Control']).toBe(PUBLIC_CACHE_CONTROL);
  });
});

describe('env: MIN_APP_VERSION / MIN_APP_MESSAGE', () => {
  it('defaults to never forcing an update', () => {
    const env = envSchema.parse(baseEnv);
    expect(env.MIN_APP_VERSION).toBe('0.0.0');
    expect(env.MIN_APP_MESSAGE).toBe('Please update the app to continue.');
  });

  it('treats blank values as unset and accepts overrides', () => {
    expect(envSchema.parse({ ...baseEnv, MIN_APP_VERSION: '', MIN_APP_MESSAGE: '' }).MIN_APP_VERSION).toBe('0.0.0');
    const env = envSchema.parse({ ...baseEnv, MIN_APP_VERSION: '2.1.3', MIN_APP_MESSAGE: 'Hi' });
    expect([env.MIN_APP_VERSION, env.MIN_APP_MESSAGE]).toEqual(['2.1.3', 'Hi']);
  });

  it('rejects a non-semver MIN_APP_VERSION', () => {
    expect(envSchema.safeParse({ ...baseEnv, MIN_APP_VERSION: 'latest' }).success).toBe(false);
  });
});
