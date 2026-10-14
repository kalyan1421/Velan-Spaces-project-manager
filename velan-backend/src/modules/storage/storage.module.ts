import { Global, Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StorageSignerService } from './storage-signer.service';

/** Global so domain modules can inject StorageService for signed URLs. */
@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService, StorageSignerService],
  exports: [StorageService, StorageSignerService],
})
export class StorageModule {}
