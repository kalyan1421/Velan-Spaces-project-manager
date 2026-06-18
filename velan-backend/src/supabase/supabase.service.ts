import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../config/env.validation';

/**
 * Provides two Supabase clients:
 *  - admin(): service-role client. Bypasses RLS. Backend-only. Used for all
 *    data access and Storage signed-URL issuance.
 *  - anon(): anon-key client. Used only for auth flows (signInWithPassword)
 *    where we act on behalf of the end user.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private adminClient!: SupabaseClient;
  private anonClient!: SupabaseClient;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const serviceKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', {
      infer: true,
    });
    const anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true });

    this.adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.anonClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Service-role client — bypasses RLS. Never expose to clients. */
  admin(): SupabaseClient {
    return this.adminClient;
  }

  /** Anon client — for auth operations on behalf of the user. */
  anon(): SupabaseClient {
    return this.anonClient;
  }
}
