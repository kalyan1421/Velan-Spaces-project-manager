import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AppRole,
  AuthenticatedUser,
} from '../common/types/authenticated-user';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Email + password login via Supabase Auth; returns the session + user. */
  async login(dto: LoginDto) {
    const { data, error } = await this.supabase
      .anon()
      .auth.signInWithPassword({ email: dto.email, password: dto.password });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.resolveUser(data.user.id);
    if (!user) throw new UnauthorizedException('User profile not found');
    if (user.isSuspended) {
      throw new ForbiddenException('Account suspended. Contact the administrator.');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user,
    };
  }

  /** Exchange a refresh token for a fresh session. */
  async refresh(refreshToken: string) {
    const { data, error } = await this.supabase
      .anon()
      .auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // A suspended user must not be able to keep a session alive via refresh.
    const user = await this.resolveUser(data.user.id);
    if (!user) throw new UnauthorizedException('User profile not found');
    if (user.isSuspended) {
      throw new ForbiddenException('Account suspended. Contact the administrator.');
    }
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    };
  }

  /** Load the app user (id + role) from the `users` table by auth id. */
  async resolveUser(authId: string): Promise<AuthenticatedUser | null> {
    if (!authId) return null;
    const { data, error } = await this.supabase
      .admin()
      .from('users')
      .select('id, email, role, display_name, is_suspended')
      .eq('id', authId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email ?? null,
      role: data.role as AppRole,
      displayName: data.display_name ?? null,
      isSuspended: data.is_suspended === true,
    };
  }
}
