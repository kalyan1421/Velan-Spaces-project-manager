import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Brokers Supabase Storage access. The client never holds storage keys:
 * it asks the backend for a short-lived signed URL, uploads/downloads
 * directly, then confirms metadata with the relevant domain module.
 */
@Injectable()
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  async signUpload(bucket: string, path: string) {
    const { data, error } = await this.supabase
      .admin()
      .storage.from(bucket)
      .createSignedUploadUrl(path);
    if (error) throw new BadRequestException(error.message);
    return { bucket, path, signedUrl: data.signedUrl, token: data.token };
  }

  async signDownload(bucket: string, path: string, expiresIn = 3600) {
    const { data, error } = await this.supabase
      .admin()
      .storage.from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error) throw new BadRequestException(error.message);
    return { bucket, path, signedUrl: data.signedUrl, expiresIn };
  }
}
