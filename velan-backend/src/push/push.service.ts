import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Env } from '../config/env.validation';

/**
 * Sends push via Firebase Cloud Messaging using the Firebase Admin SDK
 * (messaging only — no Firestore). Gracefully no-ops if no service account
 * is configured, so the API still runs in dev without FCM credentials.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app?: App;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const json = this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON', { infer: true });
    const path = this.config.get('FIREBASE_SERVICE_ACCOUNT_PATH', {
      infer: true,
    });
    if (!json && !path) {
      this.logger.warn(
        'FCM disabled: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH',
      );
      return;
    }
    try {
      const serviceAccount = JSON.parse(
        json ? PushService.decodeInline(json) : readFileSync(path as string, 'utf8'),
      );
      this.app = initializeApp({ credential: cert(serviceAccount) }, 'velan');
      this.logger.log('FCM initialized');
    } catch (e) {
      this.logger.error(`FCM init failed: ${(e as Error).message}`);
    }
  }

  /** Accepts raw JSON or base64-encoded JSON (easier to paste into a host's env UI). */
  private static decodeInline(value: string): string {
    const trimmed = value.trim();
    return trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf8');
  }

  get enabled(): boolean {
    return !!this.app;
  }

  async sendToTokens(
    tokens: string[],
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.app || tokens.length === 0) return { sent: 0, failed: 0 };
    try {
      const res = await getMessaging(this.app).sendEachForMulticast({
        tokens,
        notification,
        data,
      });
      return { sent: res.successCount, failed: res.failureCount };
    } catch (e) {
      this.logger.error(`FCM send failed: ${(e as Error).message}`);
      return { sent: 0, failed: tokens.length };
    }
  }
}
