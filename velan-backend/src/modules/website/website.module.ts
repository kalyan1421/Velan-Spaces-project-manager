import { Module } from '@nestjs/common';
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
  controllers: [WebsitePublicController, PortfolioController],
  providers: [PortfolioService, EnquiriesService],
})
export class WebsiteModule {}
