import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { Env } from '../config/env.validation';
import { parseEmailList, resolveSmtpConfig, singleLine } from './mail.util';

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Sends email over SMTP (nodemailer). Like PushService it no-ops with a
 * one-line warning when unconfigured, so dev and tests run without SMTP.
 * `send` never throws: callers fire-and-forget.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter;
  private from?: string;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const cfg = resolveSmtpConfig({
      SMTP_HOST: this.config.get('SMTP_HOST', { infer: true }),
      SMTP_PORT: this.config.get('SMTP_PORT', { infer: true }),
      SMTP_SECURE: this.config.get('SMTP_SECURE', { infer: true }),
      SMTP_USER: this.config.get('SMTP_USER', { infer: true }),
      SMTP_PASS: this.config.get('SMTP_PASS', { infer: true }),
      MAIL_FROM: this.config.get('MAIL_FROM', { infer: true }),
    });
    if (!cfg.ok) {
      this.logger.warn(`Email disabled: ${cfg.reason}`);
      return;
    }
    try {
      this.transporter = createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.auth,
      });
      this.from = cfg.from;
      this.logger.log(`Email enabled via ${cfg.host}:${cfg.port}`);
    } catch (e) {
      this.logger.error(`Email init failed: ${(e as Error).message}`);
    }
  }

  get enabled(): boolean {
    return !!this.transporter;
  }

  /** Send one message; resolves false (and logs) instead of throwing. */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.transporter) return false;
    const to = parseEmailList(message.to);
    if (to.length === 0) return false;
    const replyTo = message.replyTo ? parseEmailList([message.replyTo])[0] : undefined;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: singleLine(message.subject),
        text: message.text,
        html: message.html,
        replyTo,
      });
      return true;
    } catch (e) {
      // No addresses or content in logs.
      this.logger.error(`Email send failed (${to.length} recipient(s)): ${(e as Error).message}`);
      return false;
    }
  }
}
