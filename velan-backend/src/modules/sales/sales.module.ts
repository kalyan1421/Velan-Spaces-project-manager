import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { QuotePdfService } from './quote-pdf.service';
import { QuotationSettingsService } from './quotation-settings.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { RateCardController } from './rate-card.controller';
import { RateCardService } from './rate-card.service';

/**
 * Sales / CRM: leads, quotes (+ server PDF), rate card, quote templates and
 * quotation settings. Every route is head/manager; deletes and rate-card /
 * template / settings writes are head only. SupabaseService and ConfigService
 * come from global modules.
 */
@Module({
  controllers: [LeadsController, QuotesController, RateCardController],
  providers: [
    LeadsService,
    QuotesService,
    QuotePdfService,
    QuotationSettingsService,
    RateCardService,
  ],
})
export class SalesModule {}
