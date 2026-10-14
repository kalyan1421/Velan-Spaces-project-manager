import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { evaluateStoragePolicy, StorageMode } from './storage-policy';

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
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
  ) {}

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
    return { bucket, path, signedUrl: data.signedUrl, token: data.token };
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
    return { bucket, path, signedUrl: data.signedUrl, expiresIn };
  }
}
