import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';

/** Global so NotificationsService (and others) can inject PushService. */
@Global()
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
