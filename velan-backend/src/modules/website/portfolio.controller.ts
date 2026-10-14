import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreatePortfolioDto,
  OkResponse,
  PortfolioItemResponse,
  PortfolioUploadSignResponse,
  ReorderPortfolioDto,
  SignPortfolioUploadDto,
  UpdatePortfolioDto,
} from './dto';
import { PortfolioService } from './portfolio.service';

/** Website portfolio management — head only. */
@ApiTags('website (portfolio admin)')
@ApiBearerAuth()
@Roles('head')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: 'All portfolio items, every status (sortOrder asc, newest first)' })
  @ApiOkResponse({ type: [PortfolioItemResponse] })
  list() {
    return this.portfolio.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create an item (slug generated from the title unless given)' })
  @ApiCreatedResponse({ type: PortfolioItemResponse })
  @ApiConflictResponse({ description: 'Slug already in use' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePortfolioDto) {
    return this.portfolio.create(user.id, dto);
  }

  @Put('order')
  @ApiOperation({ summary: 'Reorder: sortOrder = index of each id (all ids must exist)' })
  @ApiOkResponse({ type: [PortfolioItemResponse] })
  reorder(@Body() dto: ReorderPortfolioDto) {
    return this.portfolio.reorder(dto.ids);
  }

  @Post('uploads/sign')
  @ApiOperation({
    summary: 'Signed upload URL for a portfolio image (JPEG/PNG/WebP/AVIF, ≤ 10 MB, public bucket)',
  })
  @ApiCreatedResponse({ type: PortfolioUploadSignResponse })
  signUpload(@Body() dto: SignPortfolioUploadDto) {
    return this.portfolio.signUpload(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partial update (null clears nullable fields; slug is not changed by a new title)' })
  @ApiOkResponse({ type: PortfolioItemResponse })
  @ApiConflictResponse({ description: 'Slug already in use' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePortfolioDto) {
    return this.portfolio.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an item (its images stay in the bucket)' })
  @ApiOkResponse({ type: OkResponse })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.portfolio.remove(id);
  }
}
