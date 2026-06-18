import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateUpdateDto } from './dto/update.dto';
import { UpdatesService } from './updates.service';

@ApiTags('updates')
@ApiBearerAuth()
@Controller('projects/:projectId/updates')
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @Get()
  @ApiOperation({ summary: 'List a project’s updates (paginated)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.updates.list(
      user,
      projectId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Post an update (supports multiple media URLs)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateUpdateDto,
  ) {
    return this.updates.create(user, projectId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an update' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.updates.remove(user, projectId, id);
  }
}
