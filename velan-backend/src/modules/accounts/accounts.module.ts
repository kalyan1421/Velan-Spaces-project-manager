import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  GoneException,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AuthService } from '../../auth/auth.service';
import { escapeLike } from '../../auth/google';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Env } from '../../config/env.validation';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  generateToken,
  hashToken,
  LINK_TTL_MS,
  LinkKind,
  linkStatus,
  linkUrl,
  looksLikeToken,
  normalizeUsername,
  workerAuthEmail,
} from './account-links';

const STAFF_COLUMNS = 'id, email, username, role, display_name, phone, trade, is_suspended';

// ---------------------------------------------------------------- DTOs
class CreateStaffDto {
  @ApiProperty({ enum: ['manager', 'worker'] })
  @IsIn(['manager', 'worker'])
  role!: 'manager' | 'worker';

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) displayName!: string;

  @ApiPropertyOptional({ description: 'Required for managers; optional for workers' })
  @ValidateIf((o: CreateStaffDto) => o.role === 'manager' || o.email !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ description: 'Required for workers (they sign in with it)' })
  @ValidateIf((o: CreateStaffDto) => o.role === 'worker' || o.username !== undefined)
  @IsString()
  @MaxLength(32)
  username?: string;

  @ApiProperty({ minLength: 8, description: 'Initial password, shared with the person by the admin' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) trade?: string;
}

class ClientInviteDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) displayName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

class AcceptInviteDto {
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) displayName?: string;
}

class ResetPasswordDto {
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(72) newPassword!: string;
}

interface LinkRow {
  id: string;
  kind: LinkKind;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  project_id: string | null;
  expires_at: string;
  used_at: string | null;
}

// ---------------------------------------------------------------- Service
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  private appUrl() {
    return this.config.get('APP_PUBLIC_URL', { infer: true });
  }

  // ------------------------------------------------------------ staff
  /** Head creates a manager (email login) or worker (username login). */
  async createStaff(dto: CreateStaffDto) {
    const email = dto.email?.trim().toLowerCase();
    let username: string | null = null;
    if (dto.username !== undefined) {
      username = normalizeUsername(dto.username);
      if (!username) {
        throw new BadRequestException(
          'Username must be 3-32 characters: letters, numbers, dot, dash or underscore',
        );
      }
    }
    if (dto.role === 'worker' && !username) throw new BadRequestException('Workers need a username');
    if (dto.role === 'manager' && !email) throw new BadRequestException('Managers need an email');

    if (username) {
      const { data } = await this.db().from('users').select('id').eq('username', username).maybeSingle();
      if (data) throw new ConflictException('That username is taken');
    }
    if (email) {
      const { data } = await this.db().from('users').select('id').ilike('email', escapeLike(email)).maybeSingle();
      if (data) throw new ConflictException('An account with that email already exists');
    }

    const authEmail = email ?? workerAuthEmail(username!, this.config.get('WORKER_EMAIL_DOMAIN', { infer: true }));
    const admin = this.db().auth.admin;
    const { data: created, error: authErr } = await admin.createUser({
      email: authEmail,
      password: dto.password,
      email_confirm: true,
    });
    if (authErr || !created.user) {
      if (/already/i.test(authErr?.message ?? '')) {
        throw new ConflictException('An account with that email already exists');
      }
      throw new Error(`createUser: ${authErr?.message ?? 'no user'}`);
    }

    const { data: row, error } = await this.db()
      .from('users')
      .insert({
        id: created.user.id,
        email: email ?? null,
        username,
        role: dto.role,
        display_name: dto.displayName.trim(),
        phone: dto.phone,
        trade: dto.trade,
      })
      .select(STAFF_COLUMNS)
      .single();
    if (error) {
      await admin.deleteUser(created.user.id);
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Username or email already in use');
      throw new Error(error.message);
    }
    return { ...row, assigned_projects: [] };
  }

  async deleteStaff(actor: AuthenticatedUser, id: string) {
    if (id === actor.id) throw new BadRequestException('You cannot delete your own account');
    const { data: target, error } = await this.db().from('users').select('id, role').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!target) throw new NotFoundException('Staff member not found');
    if (target.role !== 'manager' && target.role !== 'worker') {
      throw new ForbiddenException('Only manager and worker accounts can be deleted here');
    }
    // Memberships and links cascade; authored rows keep their content (set null).
    const { error: delErr } = await this.db().from('users').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);
    const { error: authErr } = await this.db().auth.admin.deleteUser(id);
    if (authErr) this.logger.warn(`auth user ${id} not deleted: ${authErr.message}`);
    return { deleted: true };
  }

  // ------------------------------------------------------------ password reset links
  async createResetLink(actor: AuthenticatedUser, userId: string) {
    const { data: target, error } = await this.db()
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!target) throw new NotFoundException('Account not found');
    if (target.role === 'head') throw new ForbiddenException('The administrator password cannot be reset this way');

    const token = generateToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS.password_reset).toISOString();
    const { error: insErr } = await this.db().from('account_links').insert({
      token_hash: hashToken(token),
      kind: 'password_reset',
      user_id: userId,
      created_by: actor.id,
      expires_at: expiresAt,
    });
    if (insErr) throw new Error(insErr.message);
    return { resetUrl: linkUrl(this.appUrl(), 'password_reset', token), expiresAt };
  }

  async describeResetLink(token: string) {
    const link = await this.findLink(token, 'password_reset');
    const { data: user } = await this.db()
      .from('users')
      .select('display_name, username, email')
      .eq('id', link.user_id!)
      .maybeSingle();
    return {
      displayName: user?.display_name ?? null,
      login: user?.username ?? user?.email ?? null,
      expiresAt: link.expires_at,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const link = await this.claimLink(token, 'password_reset');
    const { error } = await this.db().auth.admin.updateUserById(link.user_id!, { password: newPassword });
    if (error) {
      await this.releaseLink(link.id);
      throw new Error(`password update: ${error.message}`);
    }
    return { reset: true };
  }

  // ------------------------------------------------------------ client invites
  async createClientInvite(actor: AuthenticatedUser, projectId: string, dto: ClientInviteDto) {
    await this.access.assertMember(actor, projectId);
    const email = dto.email.trim().toLowerCase();

    const { data: existing, error } = await this.db()
      .from('users')
      .select('id, role')
      .ilike('email', escapeLike(email))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) {
      if (existing.role !== 'client') {
        throw new ConflictException('That email belongs to a staff account');
      }
      // Already a client: just give them this project too.
      const { error: mErr } = await this.db()
        .from('project_members')
        .upsert(
          { project_id: projectId, user_id: existing.id, member_role: 'client' },
          { onConflict: 'project_id,user_id,member_role', ignoreDuplicates: true },
        );
      if (mErr) throw new Error(mErr.message);
      return { alreadyRegistered: true, inviteUrl: null, expiresAt: null };
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS.client_invite).toISOString();
    const { error: insErr } = await this.db().from('account_links').insert({
      token_hash: hashToken(token),
      kind: 'client_invite',
      email,
      display_name: dto.displayName.trim(),
      phone: dto.phone,
      project_id: projectId,
      created_by: actor.id,
      expires_at: expiresAt,
    });
    if (insErr) throw new Error(insErr.message);
    return {
      alreadyRegistered: false,
      inviteUrl: linkUrl(this.appUrl(), 'client_invite', token),
      expiresAt,
    };
  }

  /** Pending (unused, unexpired) invites for a project — never the tokens. */
  async listClientInvites(actor: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(actor, projectId);
    const { data, error } = await this.db()
      .from('account_links')
      .select('id, email, display_name, phone, expires_at, used_at, created_at')
      .eq('kind', 'client_invite')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ ...r, status: linkStatus(r) }));
  }

  async describeInvite(token: string) {
    const link = await this.findLink(token, 'client_invite');
    const { data: project } = await this.db()
      .from('projects')
      .select('project_name')
      .eq('id', link.project_id!)
      .maybeSingle();
    return {
      email: link.email,
      displayName: link.display_name,
      projectName: project?.project_name ?? null,
      expiresAt: link.expires_at,
    };
  }

  /** Create the client account, add it to the project, and sign it in. */
  async acceptInvite(token: string, dto: AcceptInviteDto) {
    const link = await this.claimLink(token, 'client_invite');
    const email = link.email!;
    const admin = this.db().auth.admin;
    let authId: string | null = null;
    try {
      const { data: created, error: authErr } = await admin.createUser({
        email,
        password: dto.password,
        email_confirm: true,
      });
      if (authErr || !created.user) {
        if (/already/i.test(authErr?.message ?? '')) {
          throw new ConflictException('An account with this email already exists. Sign in instead.');
        }
        throw new Error(`createUser: ${authErr?.message ?? 'no user'}`);
      }
      authId = created.user.id;

      const { error: uErr } = await this.db().from('users').insert({
        id: authId,
        email,
        role: 'client',
        display_name: (dto.displayName ?? link.display_name ?? email).trim(),
        phone: link.phone,
      });
      if (uErr) throw new Error(uErr.message);

      const { error: mErr } = await this.db().from('project_members').insert({
        project_id: link.project_id,
        user_id: authId,
        member_role: 'client',
      });
      if (mErr) throw new Error(mErr.message);

      await this.db().from('account_links').update({ user_id: authId }).eq('id', link.id);
    } catch (e) {
      if (authId) {
        await this.db().from('users').delete().eq('id', authId);
        await admin.deleteUser(authId);
      }
      await this.releaseLink(link.id);
      throw e;
    }
    return this.auth.login({ identifier: email, password: dto.password });
  }

  // ------------------------------------------------------------ link helpers
  private async findLink(token: string, kind: LinkKind): Promise<LinkRow> {
    const notFound = new NotFoundException('This link is not valid');
    if (!looksLikeToken(token)) throw notFound;
    const { data, error } = await this.db()
      .from('account_links')
      .select('id, kind, user_id, email, display_name, phone, project_id, expires_at, used_at')
      .eq('token_hash', hashToken(token))
      .eq('kind', kind)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound;
    const status = linkStatus(data);
    if (status === 'used') throw new GoneException('This link has already been used');
    if (status === 'expired') throw new GoneException('This link has expired. Ask for a new one.');
    return data as LinkRow;
  }

  /** Atomically mark a valid link used, so it can only be redeemed once. */
  private async claimLink(token: string, kind: LinkKind): Promise<LinkRow> {
    await this.findLink(token, kind); // precise error messages
    const { data, error } = await this.db()
      .from('account_links')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', hashToken(token))
      .eq('kind', kind)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id, kind, user_id, email, display_name, phone, project_id, expires_at, used_at')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new GoneException('This link has already been used');
    return data as LinkRow;
  }

  private async releaseLink(id: string) {
    await this.db().from('account_links').update({ used_at: null }).eq('id', id);
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('accounts')
@Controller()
class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Post('staff')
  @Roles('head')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a manager (email) or worker (username) with an initial password' })
  createStaff(@Body() dto: CreateStaffDto) {
    return this.svc.createStaff(dto);
  }

  @Delete('staff/:id')
  @Roles('head')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a manager/worker account (their posts stay, unattributed)' })
  deleteStaff(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteStaff(u, id);
  }

  @Post('staff/:id/password-reset-link')
  @Roles('head')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'One-time password reset link (24h) for a manager, worker or client' })
  resetLink(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.createResetLink(u, id);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('auth/password-reset/:token')
  @ApiOperation({ summary: 'Check a reset link (who it is for, expiry)' })
  describeReset(@Param('token') token: string) {
    return this.svc.describeResetLink(token);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('auth/password-reset/:token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set a new password with a reset link (single use)' })
  resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(token, dto.newPassword);
  }

  @Post('projects/:projectId/client-invites')
  @Roles('head', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invite a client to a project (7-day link); existing clients are just added' })
  invite(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ClientInviteDto,
  ) {
    return this.svc.createClientInvite(u, projectId, dto);
  }

  @Get('projects/:projectId/client-invites')
  @Roles('head', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invites for a project with status (valid/used/expired)' })
  listInvites(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listClientInvites(u, projectId);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('auth/invites/:token')
  @ApiOperation({ summary: 'Check an invite (email, name, project, expiry)' })
  describeInvite(@Param('token') token: string) {
    return this.svc.describeInvite(token);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('auth/invites/:token/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept an invite: set a password; returns a session like login' })
  accept(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.svc.acceptInvite(token, dto);
  }
}

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
