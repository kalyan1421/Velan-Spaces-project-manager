import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';
import { Env } from '../config/env.validation';

/**
 * Sends push via Firebase Cloud Messaging using the Firebase Admin SDK
 * (messaging only — no Firestore). Gracefully no-ops if no service account
 * is configured, so the API still runs in dev without FCM credentials.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private app?: admin.app.App;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const path = this.config.get('FIREBASE_SERVICE_ACCOUNT_PATH', {
      infer: true,
    });
    if (!path) {
      this.logger.warn('FCM disabled: FIREBASE_SERVICE_ACCOUNT_PATH not set');
      return;
    }
    try {
      const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
      this.app = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        'velan',
      );
      this.logger.log('FCM initialized');
    } catch (e) {
      this.logger.error(`FCM init failed: ${(e as Error).message}`);
    }
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
      const res = await admin.messaging(this.app).sendEachForMulticast({
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
