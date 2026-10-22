import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';
import { LEAD_STATUSES } from './sales.constants';

@ApiTags('sales')
@ApiBearerAuth()
@Roles('head', 'manager')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads, newest first (head + managers see all leads)' })
  @ApiQuery({ name: 'status', required: false, enum: LEAD_STATUSES })
  @ApiQuery({ name: 'assignedManagerId', required: false, description: 'A user id, or "me"' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('assignedManagerId') assignedManagerId?: string,
  ) {
    return this.leads.list(user, { status, assignedManagerId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one lead' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a lead (status defaults to new)' })
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lead (only the fields sent; null clears)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Delete(':id')
  @Roles('head')
  @ApiOperation({ summary: 'Delete a lead and its quotes (head only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.remove(id);
  }
}
