import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global so any module (website enquiries, later invites/resets) can inject MailService. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
