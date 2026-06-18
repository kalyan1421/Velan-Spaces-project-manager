import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { computeSpend } from '../../common/calc';

// ---------------------------------------------------------------- DTOs
class TxnDto {
  @ApiProperty({ enum: ['debit', 'credit'] })
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ApiProperty() @IsNumber() amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() date?: string;
}

class SettlementDto {
  @ApiProperty() @IsNumber() amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() paidToName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proofUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() date?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
class BudgetService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  async listTransactions(u: AuthenticatedUser, projectId: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('budget_transactions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async addTransaction(u: AuthenticatedUser, projectId: string, dto: TxnDto) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('budget_transactions')
      .insert({
        project_id: projectId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        txn_date: dto.date ?? null,
        added_by: u.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.recomputeSpend(projectId);
    return data;
  }

  async listSettlements(u: AuthenticatedUser, projectId: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('settlements')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async addSettlement(
    u: AuthenticatedUser,
    projectId: string,
    dto: SettlementDto,
  ) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('settlements')
      .insert({
        project_id: projectId,
        amount: dto.amount,
        description: dto.description,
        paid_to_name: dto.paidToName,
        mode: dto.mode,
        proof_url: dto.proofUrl,
        settlement_date: dto.date ?? null,
        created_by: u.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async summary(u: AuthenticatedUser, projectId: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data: project, error: pErr } = await this.db()
      .from('projects')
      .select('budget, estimated_cost, current_spend')
      .eq('id', projectId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    return project;
  }

  /** Recompute current_spend = sum(debits) - sum(credits), server-side. */
  private async recomputeSpend(projectId: string) {
    const { data, error } = await this.db()
      .from('budget_transactions')
      .select('type, amount')
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    const spend = computeSpend(data ?? []);
    await this.db()
      .from('projects')
      .update({ current_spend: spend })
      .eq('id', projectId);
  }
}

// ---------------------------------------------------------------- Controller
// All budget/settlement access is head or budget-enabled manager (never client).
@ApiTags('budget')
@ApiBearerAuth()
@Roles('head', 'manager')
@Controller('projects/:projectId')
class BudgetController {
  constructor(private readonly svc: BudgetService) {}

  @Get('budget/transactions')
  @ApiOperation({ summary: 'List budget transactions' })
  listTxns(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) {
    return this.svc.listTransactions(u, p);
  }

  @Post('budget/transactions')
  addTxn(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Body() dto: TxnDto,
  ) {
    return this.svc.addTransaction(u, p, dto);
  }

  @Get('budget/summary')
  @ApiOperation({ summary: 'Budget totals (budget, estimate, spend)' })
  summary(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) {
    return this.svc.summary(u, p);
  }

  @Get('settlements')
  listSettlements(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
  ) {
    return this.svc.listSettlements(u, p);
  }

  @Post('settlements')
  addSettlement(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Body() dto: SettlementDto,
  ) {
    return this.svc.addSettlement(u, p, dto);
  }
}

@Module({
  controllers: [BudgetController],
  providers: [BudgetService],
})
export class BudgetModule {}
