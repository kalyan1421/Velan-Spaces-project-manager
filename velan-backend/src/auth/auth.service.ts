import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AppRole,
  AuthenticatedUser,
} from '../common/types/authenticated-user';
import { Env } from '../config/env.validation';
import { LoginDto } from './dto/login.dto';
import {
  escapeLike,
  GOOGLE_ISSUERS,
  GOOGLE_JWKS_URL,
  parseClientIds,
  verifiedGoogleEmail,
} from './google';

interface SessionLike {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClientIds: string[];
  private readonly googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService<Env, true>,
  ) {
    this.googleClientIds = parseClientIds(config.get('GOOGLE_CLIENT_IDS', { infer: true }));
  }

  /**
   * Password login. The identifier is an email, or a username (workers have
   * no email; their auth account uses a synthetic one). Every failure gives
   * the same message so it doesn't reveal which usernames exist.
   */
  async login(dto: LoginDto) {
    const invalid = new UnauthorizedException('Invalid email/username or password');
    const identifier = (dto.identifier ?? dto.email ?? '').trim();
    const email = identifier.includes('@') ? identifier : await this.emailForUsername(identifier);
    if (!email) throw invalid;

    const { data, error } = await this.supabase
      .authClient()
      .auth.signInWithPassword({ email, password: dto.password });

    if (error || !data.session || !data.user) throw invalid;
    return this.sessionResponse(data.session, await this.requireActiveUser(data.user.id));
  }

  /** username -> the sign-in email of that user's auth account (or null). */
  private async emailForUsername(username: string): Promise<string | null> {
    const normalized = username.toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) return null;
    const { data, error } = await this.supabase
      .admin()
      .from('users')
      .select('id')
      .eq('username', normalized)
      .maybeSingle();
    if (error || !data) return null;
    const { data: authUser } = await this.supabase.admin().auth.admin.getUserById(data.id);
    return authUser.user?.email ?? null;
  }

  /**
   * Google sign-in. The app sends the Google ID token; we verify it against
   * Google's keys and our OAuth client IDs, then sign the user in ONLY if a
   * Velan account with that email already exists. Unknown Google accounts are
   * rejected and nothing is created for them (accounts are provisioned by the
   * administrator, who also assigns the role).
   */
  async loginWithGoogle(idToken: string) {
    if (this.googleClientIds.length === 0) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, this.googleJwks, {
        issuer: GOOGLE_ISSUERS,
        audience: this.googleClientIds,
      }));
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in');
    }

    const email = verifiedGoogleEmail(payload);
    if (!email) throw new UnauthorizedException('Google account email is not verified');

    const { data: rows, error } = await this.supabase
      .admin()
      .from('users')
      .select('id')
      .ilike('email', escapeLike(email))
      .limit(2);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      throw new ForbiddenException(
        'No Velan Spaces account uses this Google email. Ask the administrator to add you.',
      );
    }
    if (rows.length > 1) {
      this.logger.error(`google login: multiple users rows for one email`);
      throw new ForbiddenException('Account conflict. Contact the administrator.');
    }
    const user = await this.requireActiveUser(rows[0].id as string);

    // Mint a Supabase session for that exact auth user: magic-link token
    // generated server-side and redeemed immediately (never emailed).
    const admin = this.supabase.admin().auth.admin;
    const { data: authUser, error: getErr } = await admin.getUserById(user.id);
    if (getErr || !authUser.user?.email) {
      throw new UnauthorizedException('Account has no sign-in identity');
    }
    const { data: link, error: linkErr } = await admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email,
    });
    if (linkErr || !link.properties?.hashed_token) {
      throw new Error(`generateLink failed: ${linkErr?.message ?? 'no token'}`);
    }
    const { data: verified, error: vErr } = await this.supabase
      .authClient()
      .auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
    if (vErr || !verified.session || verified.user?.id !== user.id) {
      throw new UnauthorizedException('Could not complete Google sign-in');
    }
    return this.sessionResponse(verified.session, user);
  }

  /** Exchange a refresh token for a fresh session. */
  async refresh(refreshToken: string) {
    const { data, error } = await this.supabase
      .authClient()
      .auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // A suspended user must not be able to keep a session alive via refresh.
    await this.requireActiveUser(data.user.id);
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  }

  /** Revoke the current session's refresh token (access token expires on its own). */
  async logout(accessToken: string) {
    const { error } = await this.supabase.admin().auth.admin.signOut(accessToken, 'local');
    if (error) this.logger.warn(`logout: ${error.message}`);
    return { loggedOut: true };
  }

  /** Change own password after re-checking the current one. */
  async changePassword(user: AuthenticatedUser, currentPassword: string, newPassword: string) {
    if (!user.email) throw new ForbiddenException('Account has no email login');
    const { error } = await this.supabase
      .authClient()
      .auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (error) throw new UnauthorizedException('Current password is incorrect');

    const { error: upErr } = await this.supabase
      .admin()
      .auth.admin.updateUserById(user.id, { password: newPassword });
    if (upErr) throw new Error(upErr.message);
    return { changed: true };
  }

  /** Load the app user (id + role) from the `users` table by auth id. */
  async resolveUser(authId: string): Promise<AuthenticatedUser | null> {
    if (!authId) return null;
    const { data, error } = await this.supabase
      .admin()
      .from('users')
      .select('id, email, username, role, display_name, is_suspended')
      .eq('id', authId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email ?? null,
      role: data.role as AppRole,
      displayName: data.display_name ?? null,
      username: data.username ?? null,
      isSuspended: data.is_suspended === true,
    };
  }

  private async requireActiveUser(authId: string): Promise<AuthenticatedUser> {
    const user = await this.resolveUser(authId);
    if (!user) throw new UnauthorizedException('User profile not found');
    if (user.isSuspended) {
      throw new ForbiddenException('Account suspended. Contact the administrator.');
    }
    return user;
  }

  private sessionResponse(session: SessionLike, user: AuthenticatedUser) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at,
      user,
    };
  }
}
