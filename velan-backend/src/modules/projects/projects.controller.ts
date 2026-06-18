import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects visible to the current user' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.list(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by id (membership-checked)' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projects.findOne(user, id);
  }

  @Post()
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Create a project (head/manager)' })
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Update a project (head/manager)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('head')
  @ApiOperation({ summary: 'Delete a project and its children (head only)' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }
}
