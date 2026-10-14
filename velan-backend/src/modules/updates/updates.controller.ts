import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateCommentDto, CreateUpdateDto } from './dto/update.dto';
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
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const page = parsePagination(limit, offset);
    return this.updates.list(user, projectId, page.limit, page.offset);
  }

  // Clients are view-only (as in the app); field staff and above can post.
  @Post()
  @Roles('head', 'manager', 'worker')
  @ApiOperation({ summary: 'Post an update (supports multiple media URLs)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateUpdateDto,
  ) {
    return this.updates.create(user, projectId, dto);
  }

  // Any member may comment; clients only on updates they can see.
  @Post(':id/comments')
  @ApiOperation({ summary: 'Comment on an update' })
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.updates.addComment(user, projectId, id, dto.text);
  }

  @Delete(':id')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Delete an update (head/manager)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.updates.remove(user, projectId, id);
  }
}
