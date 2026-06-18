import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

// ---------------------------------------------------------------- DTOs
class CreateDesignDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileUrl?: string;
  @ApiPropertyOptional({ default: '2D' }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roomName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approvalRequired?: boolean;
}

class CreateFileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storagePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() size?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() roomName?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
class DesignsFilesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  async listDesigns(user: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('designs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async createDesign(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreateDesignDto,
  ) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('designs')
      .insert({
        project_id: projectId,
        title: dto.title,
        file_url: dto.fileUrl,
        type: dto.type ?? '2D',
        posted_by: user.id,
        room_name: dto.roomName,
        approval_required: dto.approvalRequired ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async removeDesign(user: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(user, projectId);
    const { error } = await this.db()
      .from('designs')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }

  async listFiles(user: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async createFile(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreateFileDto,
  ) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('files')
      .insert({
        project_id: projectId,
        name: dto.name,
        title: dto.title,
        storage_path: dto.storagePath,
        category: dto.category ?? 'other',
        type: dto.type ?? 'unknown',
        size: dto.size ?? 0,
        uploaded_by: user.id,
        room_name: dto.roomName,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async removeFile(user: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(user, projectId);
    const { error } = await this.db()
      .from('files')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('designs-files')
@ApiBearerAuth()
@Controller('projects/:projectId')
class DesignsFilesController {
  constructor(private readonly svc: DesignsFilesService) {}

  @Get('designs')
  @ApiOperation({ summary: 'List designs' })
  listDesigns(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) {
    return this.svc.listDesigns(u, p);
  }

  @Post('designs')
  @ApiOperation({ summary: 'Add a design document' })
  createDesign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Body() dto: CreateDesignDto,
  ) {
    return this.svc.createDesign(u, p, dto);
  }

  @Delete('designs/:id')
  removeDesign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Param('id') id: string,
  ) {
    return this.svc.removeDesign(u, p, id);
  }

  @Get('files')
  @ApiOperation({ summary: 'List files' })
  listFiles(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) {
    return this.svc.listFiles(u, p);
  }

  @Post('files')
  @ApiOperation({ summary: 'Register an uploaded file' })
  createFile(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Body() dto: CreateFileDto,
  ) {
    return this.svc.createFile(u, p, dto);
  }

  @Delete('files/:id')
  removeFile(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Param('id') id: string,
  ) {
    return this.svc.removeFile(u, p, id);
  }
}

// ---------------------------------------------------------------- Module
@Module({
  controllers: [DesignsFilesController],
  providers: [DesignsFilesService],
})
export class DesignsFilesModule {}
