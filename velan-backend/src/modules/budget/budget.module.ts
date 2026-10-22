import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { budgetBreakdown, clientPaymentsSummary } from '../../common/calc';
import { StorageService } from '../storage/storage.service';

/** numeric(14,2) upper bound. */
const MAX_AMOUNT = 999_999_999_999.99;
const PROOF_BUCKETS = ['project-files'] as const;

// ---------------------------------------------------------------- DTOs
class TxnDto {
  @ApiProperty({ enum: ['debit', 'credit'] })
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ApiProperty() @IsNumber() @Min(0.01) @Max(MAX_AMOUNT) amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
}

class SettlementDto {
  @ApiProperty() @IsNumber() @Min(0.01) @Max(MAX_AMOUNT) amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) paidToName?: string;
  @ApiPropertyOptional({ description: 'Payment method' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  mode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proofUrl?: string;
  @ApiPropertyOptional({ example: '2026-10-14' }) @IsOptional() @IsDateString() date?: string;
}

class ExpenseDto {
  @ApiProperty({ enum: ['debit', 'credit'], description: 'debit = spent, credit = income received' })
  @IsIn(['debit', 'credit'])
  type!: 'debit' | 'credit';

  @ApiProperty() @IsNumber() @Min(0.01) @Max(MAX_AMOUNT) amount!: number;
  @ApiProperty({ example: '2026-10-14' }) @IsDateString() date!: string;
  @ApiPropertyOptional({ example: 'material' }) @IsOptional() @IsString() @MaxLength(40) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) paymentMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) accountDetails?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() proofUrl?: string;
}

class UpdateExpenseDto extends PartialType(ExpenseDto) {}

class UpdateSettlementDto extends PartialType(SettlementDto) {}

// ---------------------------------------------------------------- Service
@Injectable()
class BudgetService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  /** Recompute projects.current_spend (settlements + expense debits) in SQL. */
  private async recomputeSpend(projectId: string) {
    const { error } = await this.db().rpc('recompute_project_spend', { p_project_id: projectId });
    if (error) throw new Error(error.message);
  }

  // ------------------------------------------------------------ settlements
  async listSettlements(u: AuthenticatedUser, projectId: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('settlements')
      .select('*, person:created_by(display_name)')
      .eq('project_id', projectId)
      .order('settlement_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(({ person, ...row }) => ({
      ...row,
      created_by_name: (person as { display_name?: string } | null)?.display_name ?? null,
    }));
  }

  async addSettlement(u: AuthenticatedUser, projectId: string, dto: SettlementDto) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('settlements')
      .insert({
        project_id: projectId,
        amount: dto.amount,
        description: dto.description,
        paid_to_name: dto.paidToName,
        mode: dto.mode,
        proof_url: this.storage.normalizeProjectRef(projectId, dto.proofUrl, PROOF_BUCKETS),
        settlement_date: dto.date ?? new Date().toISOString().slice(0, 10),
        created_by: u.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.recomputeSpend(projectId);
    return { ...data, created_by_name: u.displayName };
  }

  async updateSettlement(u: AuthenticatedUser, projectId: string, id: string, dto: UpdateSettlementDto) {
    await this.access.assertBudgetAccess(u, projectId);
    const patch: Record<string, unknown> = {};
    if (dto.amount !== undefined) patch.amount = dto.amount;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.paidToName !== undefined) patch.paid_to_name = dto.paidToName;
    if (dto.mode !== undefined) patch.mode = dto.mode;
    if (dto.date !== undefined) patch.settlement_date = dto.date;
    if (dto.proofUrl !== undefined) {
      patch.proof_url = this.storage.normalizeProjectRef(projectId, dto.proofUrl, PROOF_BUCKETS);
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update');
    const { data, error } = await this.db()
      .from('settlements')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Settlement not found');
    await this.recomputeSpend(projectId);
    return data;
  }

  async removeSettlement(u: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('settlements')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('proof_url');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new NotFoundException('Settlement not found');
    await this.storage.removeRefs(data.map((r) => r.proof_url as string));
    await this.recomputeSpend(projectId);
    return { deleted: true };
  }

  // ------------------------------------------------------------ expenses
  async listExpenses(u: AuthenticatedUser, projectId: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('expenses')
      .select('*')
      .eq('project_id', projectId)
      .order('expense_date', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  }

  async addExpense(u: AuthenticatedUser, projectId: string, dto: ExpenseDto) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('expenses')
      .insert({
        project_id: projectId,
        type: dto.type,
        amount: dto.amount,
        expense_date: dto.date,
        category: dto.category ?? 'other',
        payment_method: dto.paymentMethod,
        account_details: dto.accountDetails,
        proof_url: this.storage.normalizeProjectRef(projectId, dto.proofUrl, PROOF_BUCKETS),
        created_by: u.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.recomputeSpend(projectId);
    return data;
  }

  async updateExpense(u: AuthenticatedUser, projectId: string, id: string, dto: UpdateExpenseDto) {
    await this.access.assertBudgetAccess(u, projectId);
    const patch: Record<string, unknown> = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.amount !== undefined) patch.amount = dto.amount;
    if (dto.date !== undefined) patch.expense_date = dto.date;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.paymentMethod !== undefined) patch.payment_method = dto.paymentMethod;
    if (dto.accountDetails !== undefined) patch.account_details = dto.accountDetails;
    if (dto.proofUrl !== undefined) {
      patch.proof_url = this.storage.normalizeProjectRef(projectId, dto.proofUrl, PROOF_BUCKETS);
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update');

    const { data, error } = await this.db()
      .from('expenses')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Expense not found');
    await this.recomputeSpend(projectId);
    return data;
  }

  async removeExpense(u: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const { data, error } = await this.db()
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('proof_url');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new NotFoundException('Expense not found');
    await this.storage.removeRefs(data.map((r) => r.proof_url as string));
    await this.recomputeSpend(projectId);
    return { deleted: true };
  }

  // ------------------------------------------------------------ summary
  async summary(u: AuthenticatedUser, projectId: string) {
    await this.access.assertBudgetAccess(u, projectId);
    const [project, settlements, expenses] = await Promise.all([
      this.db().from('projects').select('budget, estimated_cost').eq('id', projectId).maybeSingle(),
      this.db().from('settlements').select('amount').eq('project_id', projectId),
      this.db().from('expenses').select('type, amount').eq('project_id', projectId),
    ]);
    for (const r of [project, settlements, expenses]) if (r.error) throw new Error(r.error.message);
    if (!project.data) throw new NotFoundException('Project not found');

    const b = budgetBreakdown(settlements.data ?? [], expenses.data ?? []);
    const budget = Number(project.data.budget) || 0;
    return {
      budget,
      estimatedCost: Number(project.data.estimated_cost) || 0,
      ...b,
      remaining: Math.round((budget - b.currentSpend) * 100) / 100,
    };
  }

  // ------------------------------------------------------------ client view
  /**
   * Budget vs payments received, for the client portal. Clients of the
   * project may read it; staff need budget access. Never includes spend,
   * settlements, expenses, estimated cost or payment notes/proofs.
   */
  async clientPayments(u: AuthenticatedUser, projectId: string) {
    if (u.role === 'client') await this.access.assertMember(u, projectId);
    else await this.access.assertBudgetAccess(u, projectId);
    const [project, credits] = await Promise.all([
      this.db().from('projects').select('budget').eq('id', projectId).maybeSingle(),
      this.db()
        .from('expenses')
        .select('id, amount, expense_date, payment_method, created_at')
        .eq('project_id', projectId)
        .eq('type', 'credit')
        .order('expense_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    ]);
    for (const r of [project, credits]) if (r.error) throw new Error(r.error.message);
    if (!project.data) throw new NotFoundException('Project not found');

    const rows = credits.data ?? [];
    return {
      ...clientPaymentsSummary(project.data.budget, rows),
      payments: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount) || 0,
        date: r.expense_date ?? r.created_at,
        paymentMethod: r.payment_method ?? null,
      })),
    };
  }

  // ------------------------------------------------------------ legacy
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
    return data;
  }
}

// ---------------------------------------------------------------- Controller
// Money is head or budget-enabled managers only (never workers or clients).
@ApiTags('budget')
@ApiBearerAuth()
@Roles('head', 'manager')
@Controller('projects/:projectId')
class BudgetController {
  constructor(private readonly svc: BudgetService) {}

  @Get('budget/summary')
  @ApiOperation({ summary: 'Budget, spend (settlements + expense debits), income, remaining' })
  summary(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.summary(u, p);
  }

  @Get('settlements')
  listSettlements(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.listSettlements(u, p);
  }

  @Post('settlements')
  @ApiOperation({ summary: 'Record a payment; updates project spend' })
  addSettlement(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: SettlementDto,
  ) {
    return this.svc.addSettlement(u, p, dto);
  }

  @Patch('settlements/:id')
  @ApiOperation({ summary: 'Correct a settlement; updates project spend' })
  updateSettlement(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSettlementDto,
  ) {
    return this.svc.updateSettlement(u, p, id, dto);
  }

  @Delete('settlements/:id')
  @ApiOperation({ summary: 'Delete a settlement; updates project spend' })
  removeSettlement(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.removeSettlement(u, p, id);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Expenses (debit) and income (credit), oldest first' })
  listExpenses(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.listExpenses(u, p);
  }

  @Post('expenses')
  addExpense(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: ExpenseDto,
  ) {
    return this.svc.addExpense(u, p, dto);
  }

  @Patch('expenses/:id')
  updateExpense(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.svc.updateExpense(u, p, id, dto);
  }

  @Delete('expenses/:id')
  removeExpense(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.removeExpense(u, p, id);
  }

  @Get('budget/transactions')
  @ApiOperation({ summary: 'Legacy ledger (unused by the app; not counted in spend)', deprecated: true })
  listTxns(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.listTransactions(u, p);
  }

  @Post('budget/transactions')
  @ApiOperation({ summary: 'Legacy ledger (unused by the app; not counted in spend)', deprecated: true })
  addTxn(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: TxnDto,
  ) {
    return this.svc.addTransaction(u, p, dto);
  }
}

// The one money view clients get: budget vs their own payments.
@ApiTags('budget')
@ApiBearerAuth()
@Roles('head', 'manager', 'client')
@Controller('projects/:projectId')
class ClientPaymentsController {
  constructor(private readonly svc: BudgetService) {}

  @Get('client-payments')
  @ApiOperation({ summary: 'Budget, payments received from the client, balance (client portal)' })
  clientPayments(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.clientPayments(u, p);
  }
}

@Module({
  controllers: [BudgetController, ClientPaymentsController],
  providers: [BudgetService],
})
export class BudgetModule {}
