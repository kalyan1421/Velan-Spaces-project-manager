import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { evaluateStoragePolicy, StorageMode } from './storage-policy';
import { isRef, normalizeProjectRef, parseStorageRef, publicizeStorageUrl } from './storage-refs';

/**
 * Brokers Supabase Storage access. The client never holds storage keys:
 * it asks the backend for a short-lived signed URL, uploads/downloads
 * directly, then confirms metadata with the relevant domain module.
 *
 * Every request is authorized first (role, bucket/path convention, file
 * type, and project membership) — a signed URL is a bearer capability, so
 * handing one out is equivalent to granting access.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Canonicalise file references sent for a project-scoped row (see
   * storage-refs.ts). Throws 400 if any points outside the project's folder.
   */
  normalizeProjectRefs(
    projectId: string,
    values: string[] | undefined | null,
    buckets: readonly string[],
  ): string[] {
    return (values ?? []).map((v) => this.normalizeProjectRef(projectId, v, buckets) as string);
  }

  normalizeProjectRef(
    projectId: string,
    value: string | undefined | null,
    buckets: readonly string[],
  ): string | null {
    if (value === undefined || value === null || value === '') return null;
    const res = normalizeProjectRef(value, {
      supabaseUrls: this.storageBases(),
      projectId,
      buckets,
    });
    if (!res.ok) throw new BadRequestException(res.reason);
    return res.value;
  }

  /** Addresses whose storage URLs we recognise as ours (public first). */
  private storageBases(): string[] {
    const internal = this.config.get('SUPABASE_URL', { infer: true });
    const pub = this.config.get('SUPABASE_PUBLIC_URL', { infer: true });
    return pub ? [pub, internal] : [internal];
  }

  /** A storage URL clients can reach (see SUPABASE_PUBLIC_URL). */
  publicUrl(url: string): string {
    return publicizeStorageUrl(
      url,
      this.config.get('SUPABASE_URL', { infer: true }),
      this.config.get('SUPABASE_PUBLIC_URL', { infer: true }),
    );
  }

  /** Best-effort delete of the objects behind `sb://` refs (other values ignored). */
  async removeRefs(values: (string | null | undefined)[]): Promise<void> {
    const byBucket = new Map<string, string[]>();
    for (const v of values) {
      if (!isRef(v)) continue;
      const ref = parseStorageRef(v, '');
      if (!ref) continue;
      byBucket.set(ref.bucket, [...(byBucket.get(ref.bucket) ?? []), ref.path]);
    }
    for (const [bucket, paths] of byBucket) {
      const { error } = await this.supabase.admin().storage.from(bucket).remove(paths);
      if (error) this.logger.warn(`remove from ${bucket}: ${error.message}`);
    }
  }

  private async authorize(
    user: AuthenticatedUser,
    bucket: string,
    path: string,
    mode: StorageMode,
  ): Promise<void> {
    const decision = evaluateStoragePolicy({
      bucket,
      path,
      mode,
      role: user.role,
      userId: user.id,
    });
    if (!decision.allowed) {
      if (decision.status === 403) throw new ForbiddenException(decision.reason);
      throw new BadRequestException(decision.reason);
    }
    if (decision.projectId) {
      await this.access.assertMember(user, decision.projectId);
    }
  }

  async signUpload(user: AuthenticatedUser, bucket: string, path: string) {
    await this.authorize(user, bucket, path, 'upload');
    const { data, error } = await this.supabase
      .admin()
      .storage.from(bucket)
      .createSignedUploadUrl(path);
    if (error) throw new BadRequestException('Could not create upload URL');
    return { bucket, path, signedUrl: this.publicUrl(data.signedUrl), token: data.token };
  }

  async signDownload(
    user: AuthenticatedUser,
    bucket: string,
    path: string,
    expiresIn = 3600,
  ) {
    await this.authorize(user, bucket, path, 'download');
    const { data, error } = await this.supabase
      .admin()
      .storage.from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error) throw new BadRequestException('Could not create download URL');
    return { bucket, path, signedUrl: this.publicUrl(data.signedUrl), expiresIn };
  }
}
