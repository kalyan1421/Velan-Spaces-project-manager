import { Module } from '@nestjs/common';
import { AppVersionController } from './app-version.controller';
import { EnquiriesService } from './enquiries.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { WebsitePublicController } from './website-public.controller';

/**
 * Public website backend: portfolio (public reads + head admin) and the
 * enquiry form -> leads. SupabaseService, ConfigService and
 * NotificationsService come from global modules.
 */
@Module({
  controllers: [WebsitePublicController, AppVersionController, PortfolioController],
  providers: [PortfolioService, EnquiriesService],
})
export class WebsiteModule {}
