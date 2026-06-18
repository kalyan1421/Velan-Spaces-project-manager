import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { Env } from '../config/env.validation';
import { AuthService } from './auth.service';

/**
 * Verifies the Supabase-issued JWT against the project's JWKS (asymmetric
 * signing keys — ECC/ES256). Falls back-compatible with rotated keys since
 * jose fetches all current public keys from the JWKS endpoint and caches them.
 * Then loads the app user from `users` and attaches it to the request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
    private readonly authService: AuthService,
  ) {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    this.issuer = `${url}/auth/v1`;
    this.jwks = createRemoteJWKSet(
      new URL(`${url}/auth/v1/.well-known/jwks.json`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.authService.resolveUser(payload.sub as string);
    if (!user) throw new UnauthorizedException('User not found');

    (req as Request & { user: unknown }).user = user;
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [type, value] = header.split(' ');
    return type === 'Bearer' && value ? value : null;
  }
}
