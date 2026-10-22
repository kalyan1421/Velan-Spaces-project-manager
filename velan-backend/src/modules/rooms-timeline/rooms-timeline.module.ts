import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.module';
import {
  newTaskAssignments,
  TaskRef,
  taskAssignmentNotification,
} from '../notifications/notification-recipients';
import {
  ChecklistItem,
  derivePhaseStatus,
  normalizePhase,
  normalizeTask,
  PHASE_STATUSES,
  PhaseStatus,
  projectProgress,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskStatus,
} from './timeline-logic';

const PROOF_BUCKETS = ['project-files'] as const;

// ---------------------------------------------------------------- DTOs
class RoomDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assignedWorkerIds?: string[];
}

class UpdateRoomDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assignedWorkerIds?: string[];
}

class ChecklistItemDto {
  // The app builds ids as "<millis>-<label>", so allow label length + prefix.
  @ApiProperty() @IsString() @MaxLength(400) id!: string;
  @ApiProperty() @IsString() @MaxLength(300) label!: string;
  @ApiProperty() @IsBoolean() isDone!: boolean;
}

class TaskCommentDto {
  @ApiProperty() @IsString() @MaxLength(100) id!: string;
  @ApiProperty() @IsString() @MaxLength(2000) text!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) postedBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) postedById?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() createdAt?: string | null;
}

class TaskInputDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() id?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @ApiProperty({ enum: TASK_STATUSES }) @IsIn(TASK_STATUSES as unknown as string[]) status!: TaskStatus;
  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES as unknown as string[])
  priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedWorkerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() roomId?: string | null;
  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklistItems?: ChecklistItemDto[];
  @ApiPropertyOptional({ type: [TaskCommentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TaskCommentDto)
  comments?: TaskCommentDto[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  photoProofUrls?: string[];
  @ApiPropertyOptional() @IsOptional() @IsDateString() createdAt?: string | null;
}

class PhaseInputDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() id?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiPropertyOptional({ enum: PHASE_STATUSES })
  @IsOptional()
  @IsIn(PHASE_STATUSES as unknown as string[])
  status?: PhaseStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() createdAt?: string | null;
  @ApiProperty({ type: [TaskInputDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => TaskInputDto)
  tasks!: TaskInputDto[];
}

class ReplaceTimelineDto {
  @ApiProperty({ type: [PhaseInputDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PhaseInputDto)
  phases!: PhaseInputDto[];
}

class NewCommentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000) text!: string;
}

/** Field-team progress on one task. Plan fields (title, dates, assignee…) are head/manager only. */
class TaskPatchDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES as unknown as string[])
  status?: TaskStatus;
  @ApiPropertyOptional({ type: [ChecklistItemDto], description: 'Workers may only change isDone' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklistItems?: ChecklistItemDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(400) toggleChecklistItemId?: string;
  @ApiPropertyOptional({ type: NewCommentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewCommentDto)
  addComment?: NewCommentDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) addPhotoProofUrl?: string;
  // head/manager only
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES as unknown as string[])
  priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedWorkerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() roomId?: string | null;
}

const PLAN_FIELDS: (keyof TaskPatchDto)[] = [
  'title',
  'description',
  'priority',
  'plannedStart',
  'plannedEnd',
  'assignedWorkerId',
  'roomId',
];

interface TaskRow {
  id: string;
  phase_id: string;
  project_id: string;
  status: TaskStatus;
  checklist_items: ChecklistItem[];
  comments: unknown[];
  photo_proof_urls: string[];
  actual_start: string | null;
  actual_end: string | null;
  assigned_worker_id: string | null;
  [k: string]: unknown;
}

type TaskRefRow = { id: string; title?: unknown; assigned_worker_id: string | null };
const toTaskRef = (t: TaskRefRow): TaskRef => ({
  id: t.id,
  title: (t.title as string | null | undefined) ?? null,
  assignedWorkerId: t.assigned_worker_id ?? null,
});

// ---------------------------------------------------------------- Service
@Injectable()
class RoomsTimelineService {
  private readonly logger = new Logger('RoomsTimelineService');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  // ------------------------------------------------------------ rooms
  async listRooms(u: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('rooms')
      .select('*')
      .eq('project_id', projectId)
      .order('name');
    if (error) throw new Error(error.message);
    return data;
  }

  async createRoom(u: AuthenticatedUser, projectId: string, dto: RoomDto) {
    await this.access.assertMember(u, projectId);
    await this.assertProjectWorkers(projectId, dto.assignedWorkerIds ?? []);
    const { data, error } = await this.db()
      .from('rooms')
      .insert({
        project_id: projectId,
        name: dto.name,
        assigned_worker_ids: dto.assignedWorkerIds ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateRoom(u: AuthenticatedUser, projectId: string, id: string, dto: UpdateRoomDto) {
    await this.access.assertMember(u, projectId);
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.assignedWorkerIds !== undefined) {
      await this.assertProjectWorkers(projectId, dto.assignedWorkerIds);
      patch.assigned_worker_ids = dto.assignedWorkerIds;
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update');
    const { data, error } = await this.db()
      .from('rooms')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Room not found');
    return data;
  }

  async removeRoom(u: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(u, projectId);
    const { error } = await this.db()
      .from('rooms')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }

  // ------------------------------------------------------------ timeline
  /** Phases (ordered) with their tasks nested, the shape the app works with. */
  async getTimeline(u: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(u, projectId);
    return this.loadTimeline(projectId);
  }

  /** Save the whole plan atomically (head/manager). */
  async replaceTimeline(u: AuthenticatedUser, projectId: string, dto: ReplaceTimelineDto) {
    await this.access.assertMember(u, projectId);
    const now = new Date().toISOString();

    const workerIds = dto.phases.flatMap((p) => p.tasks.map((t) => t.assignedWorkerId)).filter(Boolean) as string[];
    const roomIds = dto.phases.flatMap((p) => p.tasks.map((t) => t.roomId)).filter(Boolean) as string[];
    await this.assertProjectWorkers(projectId, workerIds);
    await this.assertProjectRooms(projectId, roomIds);
    this.assertUniqueIds(dto);
    const previousTasks = await this.taskAssignmentsSnapshot(projectId);

    const phases = dto.phases.map((p) => {
      const tasks = p.tasks.map((t) => ({
        ...t,
        checklistItems: t.checklistItems ?? [],
        comments: t.comments ?? [],
        photoProofUrls: this.storage.normalizeProjectRefs(projectId, t.photoProofUrls, PROOF_BUCKETS),
        actualStart: t.actualStart ?? null,
        actualEnd: t.actualEnd ?? null,
      }));
      return normalizePhase({ ...p, status: p.status ?? 'pending', tasks }, now);
    });

    const { error } = await this.db().rpc('replace_project_timeline', {
      p_project_id: projectId,
      p_phases: phases,
    });
    if (error) throw new Error(error.message);

    await this.persistProgress(projectId, phases);
    const timeline = await this.loadTimeline(projectId);
    if (previousTasks) {
      const after = timeline.flatMap((p) => (p.tasks as TaskRow[]).map(toTaskRef));
      this.notifyAssignments(u, projectId, previousTasks, after);
    }
    return timeline;
  }

  /** Progress on one task: status, checklist, comments, photo proofs. */
  async patchTask(u: AuthenticatedUser, projectId: string, taskId: string, dto: TaskPatchDto) {
    await this.access.assertMember(u, projectId);
    const { data: row, error } = await this.db()
      .from('timeline_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new NotFoundException('Task not found');
    const task = row as TaskRow;

    const isStaff = u.role === 'head' || u.role === 'manager';
    if (!isStaff) {
      if (task.assigned_worker_id !== u.id) {
        throw new ForbiddenException('You can only update tasks assigned to you');
      }
      if (PLAN_FIELDS.some((f) => dto[f] !== undefined)) {
        throw new ForbiddenException('Only managers can change the task plan');
      }
    }

    const patch: Record<string, unknown> = {};
    let checklist: ChecklistItem[] = task.checklist_items ?? [];

    if (dto.checklistItems !== undefined) {
      if (isStaff) {
        checklist = dto.checklistItems.map((i) => ({ id: i.id, label: i.label, isDone: i.isDone }));
      } else {
        // Workers tick items; labels and the item set stay as planned.
        const done = new Map(dto.checklistItems.map((i) => [i.id, i.isDone]));
        checklist = checklist.map((i) => (done.has(i.id) ? { ...i, isDone: done.get(i.id)! } : i));
      }
    }
    if (dto.toggleChecklistItemId !== undefined) {
      if (!checklist.some((i) => i.id === dto.toggleChecklistItemId)) {
        throw new BadRequestException('Checklist item not found');
      }
      checklist = checklist.map((i) => (i.id === dto.toggleChecklistItemId ? { ...i, isDone: !i.isDone } : i));
    }
    if (dto.addComment) {
      patch.comments = [
        ...(task.comments ?? []),
        {
          id: randomUUID(),
          text: dto.addComment.text,
          postedBy: u.displayName ?? u.email ?? 'User',
          postedById: u.id,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    if (dto.addPhotoProofUrl !== undefined) {
      const ref = this.storage.normalizeProjectRef(projectId, dto.addPhotoProofUrl, PROOF_BUCKETS);
      patch.photo_proof_urls = [...(task.photo_proof_urls ?? []), ref];
    }
    if (dto.assignedWorkerId) await this.assertProjectWorkers(projectId, [dto.assignedWorkerId]);
    if (dto.roomId) await this.assertProjectRooms(projectId, [dto.roomId]);
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.plannedStart !== undefined) patch.planned_start = dto.plannedStart;
    if (dto.plannedEnd !== undefined) patch.planned_end = dto.plannedEnd;
    if (dto.assignedWorkerId !== undefined) patch.assigned_worker_id = dto.assignedWorkerId;
    if (dto.roomId !== undefined) patch.room_id = dto.roomId;

    const normalized = normalizeTask(
      {
        status: dto.status ?? task.status,
        checklistItems: checklist,
        actualStart: task.actual_start,
        actualEnd: task.actual_end,
      },
      new Date().toISOString(),
    );
    patch.status = normalized.status;
    patch.checklist_items = normalized.checklistItems;
    patch.actual_start = normalized.actualStart;
    patch.actual_end = normalized.actualEnd;
    patch.updated_at = new Date().toISOString();

    const { data: updated, error: upErr } = await this.db()
      .from('timeline_tasks')
      .update(patch)
      .eq('id', taskId)
      .select()
      .single();
    if (upErr) throw new Error(upErr.message);

    await this.refreshPhaseAndProject(projectId, task.phase_id);
    if (dto.assignedWorkerId !== undefined) {
      this.notifyAssignments(u, projectId, [toTaskRef(task)], [toTaskRef(updated as TaskRow)]);
    }
    return updated;
  }

  // ------------------------------------------------------------ notifications
  /** Current task -> worker assignments; null (skip notifying) if unreadable. */
  private async taskAssignmentsSnapshot(projectId: string): Promise<TaskRef[] | null> {
    try {
      const { data, error } = await this.db()
        .from('timeline_tasks')
        .select('id, title, assigned_worker_id')
        .eq('project_id', projectId);
      if (error) throw new Error(error.message);
      return ((data ?? []) as TaskRefRow[]).map(toTaskRef);
    } catch (e) {
      this.logger.warn(`Timeline ${projectId}: could not read assignments (${(e as Error).message})`);
      return null;
    }
  }

  /** Tell each worker about tasks newly (re)assigned to them. Fire-and-forget. */
  private notifyAssignments(u: AuthenticatedUser, projectId: string, before: TaskRef[], after: TaskRef[]) {
    try {
      const byWorker = newTaskAssignments(before, after, u.id);
      for (const [workerId, tasks] of byWorker) {
        void this.notifications
          .notifyUsers([workerId], taskAssignmentNotification(tasks, projectId, u.id, u.displayName))
          .catch((e: Error) => this.logger.warn(`Task assignment notify failed (${e.message})`));
      }
    } catch (e) {
      this.logger.warn(`Task assignment notify failed (${(e as Error).message})`);
    }
  }

  // ------------------------------------------------------------ helpers
  private async loadTimeline(projectId: string) {
    const [phasesRes, tasksRes] = await Promise.all([
      this.db().from('timeline_phases').select('*').eq('project_id', projectId).order('order_index'),
      this.db()
        .from('timeline_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index')
        .order('created_at'),
    ]);
    if (phasesRes.error) throw new Error(phasesRes.error.message);
    if (tasksRes.error) throw new Error(tasksRes.error.message);
    const byPhase = new Map<string, Record<string, unknown>[]>();
    for (const t of tasksRes.data ?? []) {
      byPhase.set(t.phase_id, [...(byPhase.get(t.phase_id) ?? []), t]);
    }
    return (phasesRes.data ?? []).map((p) => ({ ...p, tasks: byPhase.get(p.id) ?? [] }));
  }

  private async refreshPhaseAndProject(projectId: string, phaseId: string) {
    const timeline = await this.loadTimeline(projectId);
    const phases = timeline.map((p) => ({
      id: p.id as string,
      status: p.status as PhaseStatus,
      tasks: (p.tasks as TaskRow[]).map((t) => ({
        status: t.status,
        checklistItems: t.checklist_items ?? [],
        actualStart: t.actual_start,
        actualEnd: t.actual_end,
      })),
    }));
    const phase = phases.find((p) => p.id === phaseId);
    if (phase) {
      const next = derivePhaseStatus(phase.tasks, phase.status);
      if (next !== phase.status) {
        phase.status = next;
        const { error } = await this.db()
          .from('timeline_phases')
          .update({ status: next, updated_at: new Date().toISOString() })
          .eq('id', phaseId);
        if (error) throw new Error(error.message);
      }
    }
    await this.persistProgress(projectId, phases);
  }

  private async persistProgress(
    projectId: string,
    phases: { status: PhaseStatus; tasks: { status: TaskStatus }[] }[],
  ) {
    const { completionPercentage, isComplete } = projectProgress(
      phases.map((p) => ({
        status: p.status,
        tasks: p.tasks.map((t) => ({ status: t.status, checklistItems: [], actualStart: null, actualEnd: null })),
      })),
    );
    const { error } = await this.db()
      .from('projects')
      .update({ completion_percentage: completionPercentage, is_complete: isComplete })
      .eq('id', projectId);
    if (error) throw new Error(error.message);
  }

  private assertUniqueIds(dto: ReplaceTimelineDto) {
    const ids = [
      ...dto.phases.map((p) => p.id),
      ...dto.phases.flatMap((p) => p.tasks.map((t) => t.id)),
    ].filter(Boolean) as string[];
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate phase/task id');
  }

  private async assertProjectWorkers(projectId: string, ids: string[]) {
    const wanted = [...new Set(ids)];
    if (wanted.length === 0) return;
    const { data, error } = await this.db()
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('member_role', 'worker')
      .in('user_id', wanted);
    if (error) throw new Error(error.message);
    const found = new Set((data ?? []).map((r) => r.user_id));
    const missing = wanted.filter((id) => !found.has(id));
    if (missing.length > 0) throw new BadRequestException('Assigned worker is not on this project');
  }

  private async assertProjectRooms(projectId: string, ids: string[]) {
    const wanted = [...new Set(ids)];
    if (wanted.length === 0) return;
    const { data, error } = await this.db()
      .from('rooms')
      .select('id')
      .eq('project_id', projectId)
      .in('id', wanted);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== wanted.length) throw new BadRequestException('Room is not in this project');
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('rooms-timeline')
@ApiBearerAuth()
@Controller('projects/:projectId')
class RoomsTimelineController {
  constructor(private readonly svc: RoomsTimelineService) {}

  @Get('rooms')
  listRooms(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.listRooms(u, p);
  }

  @Post('rooms')
  @Roles('head', 'manager')
  createRoom(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: RoomDto,
  ) {
    return this.svc.createRoom(u, p, dto);
  }

  @Patch('rooms/:id')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Rename a room / change its assigned workers' })
  updateRoom(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.svc.updateRoom(u, p, id, dto);
  }

  @Delete('rooms/:id')
  @Roles('head', 'manager')
  removeRoom(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.removeRoom(u, p, id);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Timeline: ordered phases with nested tasks' })
  getTimeline(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.getTimeline(u, p);
  }

  @Put('timeline')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Replace the whole timeline atomically; recomputes project completion' })
  replaceTimeline(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: ReplaceTimelineDto,
  ) {
    return this.svc.replaceTimeline(u, p, dto);
  }

  @Patch('timeline/tasks/:taskId')
  @Roles('head', 'manager', 'worker')
  @ApiOperation({ summary: 'Task progress (workers: own tasks; status, checklist, comments, photos)' })
  patchTask(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: TaskPatchDto,
  ) {
    return this.svc.patchTask(u, p, taskId, dto);
  }
}

@Module({
  controllers: [RoomsTimelineController],
  providers: [RoomsTimelineService],
})
export class RoomsTimelineModule {}
