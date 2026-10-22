import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import { QuotePdfService } from './quote-pdf.service';
import { QuotesService } from './quotes.service';

@ApiTags('sales')
@ApiBearerAuth()
@Roles('head', 'manager')
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly pdf: QuotePdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List quotes, newest first (optionally for one lead)' })
  @ApiQuery({ name: 'leadId', required: false, description: 'Lead id (uuid)' })
  list(@Query('leadId', new ParseUUIDPipe({ optional: true })) leadId?: string) {
    return this.quotes.list({ leadId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one quote' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.get(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Quotation PDF (inline, or attachment with ?download=1; filename = quote number)' })
  @ApiQuery({ name: 'download', required: false, description: '1/true = Content-Disposition: attachment' })
  @ApiProduces('application/pdf')
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @Query('download') download?: string,
  ) {
    // @Res(): the bytes bypass the JSON interceptors (camelCase / ref signing).
    const { fileName, pdf } = await this.pdf.render(id);
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
      'Content-Disposition': `${disposition}; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    });
    res.end(pdf);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a quote — number assigned by the server, totals computed from sections',
  })
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto);
  }

  @Post(':id/duplicate')
  @HttpCode(201)
  @ApiOperation({ summary: 'Copy a quote as a new draft with a new number, dated today' })
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.duplicate(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a quote (only the fields sent); totals are recomputed' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(id, dto);
  }

  @Delete(':id')
  @Roles('head')
  @ApiOperation({ summary: 'Delete a quote (head only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotes.remove(id);
  }
}
