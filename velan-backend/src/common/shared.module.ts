import { Global, Module } from '@nestjs/common';
import { ProjectAccessService } from './services/project-access.service';

/** Global helpers shared across domain modules. */
@Global()
@Module({
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class SharedModule {}
