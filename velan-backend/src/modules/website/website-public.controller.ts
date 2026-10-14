import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { EnquiryDto, OkResponse, PublicPortfolioItemResponse } from './dto';
import { EnquiriesService } from './enquiries.service';
import { PortfolioService } from './portfolio.service';
import { parseCategory, PORTFOLIO_CATEGORIES } from './website.util';

/** Browsers 1 min, shared caches/CDN 5 min. Set only on successful responses. */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

/** Unauthenticated endpoints backing the public website. */
@ApiTags('website (public)')
@Public()
@Controller('public')
export class WebsitePublicController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly enquiries: EnquiriesService,
  ) {}

  @Get('portfolio')
  @ApiOperation({ summary: 'Published portfolio items (sortOrder asc, newest first)' })
  @ApiQuery({ name: 'category', required: false, enum: PORTFOLIO_CATEGORIES })
  @ApiOkResponse({ type: [PublicPortfolioItemResponse] })
  async list(
    @Query('category') category: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = parseCategory(category);
    if (parsed === null) {
      throw new BadRequestException(`category must be one of: ${PORTFOLIO_CATEGORIES.join(', ')}`);
    }
    const items = await this.portfolio.listPublic(parsed);
    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    return items;
  }

  @Get('portfolio/:slug')
  @ApiOperation({ summary: 'One published portfolio item by slug (404 unless published)' })
  @ApiOkResponse({ type: PublicPortfolioItemResponse })
  @ApiNotFoundResponse({ description: 'Unknown or unpublished slug' })
  async get(@Param('slug') slug: string, @Res({ passthrough: true }) res: Response) {
    const item = await this.portfolio.getPublicBySlug(slug);
    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    return item;
  }

  // Spam control: 5 / minute / client IP (needs TRUST_PROXY_HOPS behind proxies).
  @Post('enquiries')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Website enquiry -> new lead (source "website"); notifies heads' })
  @ApiCreatedResponse({ type: OkResponse })
  @ApiTooManyRequestsResponse({ description: 'More than 5 enquiries per minute from this IP' })
  submit(@Body() dto: EnquiryDto) {
    return this.enquiries.submit(dto);
  }
}
