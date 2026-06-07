import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/common/async_value_widget.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/add_expense_dialog.dart';

class BudgetTab extends ConsumerWidget {
  const BudgetTab({required this.projectId, super.key});
  final String projectId;

  static void _showProofDialog(BuildContext context, String proofUrl, String title) {
    showProofBottomSheet(context, proofUrl, title);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectAsync = ref.watch(projectDetailProvider(projectId));
    final userRole = ref.watch(currentUserRoleProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: (userRole == UserRole.head || userRole == UserRole.manager)
          ? FloatingActionButton(
              heroTag: 'budget_fab',
              onPressed: () {
                showFormBottomSheet(
                  context: context,
                  title: 'Add Transaction',
                  child: AddExpenseDialog(projectId: projectId),
                );
              },
              child: const Icon(Icons.add),
            )
          : null,
      body: AsyncValueWidget(
        value: projectAsync,
        emptyMessage: 'Project details not found.',
        data: (project) {
          final budgetAsync = ref.watch(projectExpensesProvider(projectId));
          return AsyncValueWidget(
            value: budgetAsync,
            emptyMessage: 'No expenses recorded',
            data: (transactions) {
              final income = transactions
                  .where((t) => t.type == 'credit')
                  .fold<double>(0, (s, t) => s + t.amount);
              final expense = transactions
                  .where((t) => t.type == 'debit')
                  .fold<double>(0, (s, t) => s + t.amount);

              final totalBudget = project.budget;
              final budgetUsed = expense;
              final budgetRemaining = totalBudget - budgetUsed;
              
              final usagePercent = totalBudget > 0 ? (budgetUsed / totalBudget).clamp(0.0, 1.0) : 0.0;
              final isOverBudget = budgetUsed > totalBudget && totalBudget > 0;

              return Column(
                children: [
                  // ─── Budget Health Dashboard ─────────────────────
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Container(
                      decoration: BoxDecoration(
                        color: VelanTheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Budget Health',
                                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: (isOverBudget ? Theme.of(context).colorScheme.error : VelanTheme.success).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  isOverBudget ? 'Over Budget' : 'On Track',
                                  style: TextStyle(
                                    color: isOverBudget ? Theme.of(context).colorScheme.error : VelanTheme.success,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Total Budget',
                                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    FormatUtils.formatCurrency(totalBudget),
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    'Spent',
                                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    FormatUtils.formatCurrency(budgetUsed),
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: LinearProgressIndicator(
                              value: usagePercent,
                              minHeight: 10,
                              backgroundColor: Colors.grey.shade200,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                isOverBudget ? Theme.of(context).colorScheme.error : VelanTheme.primaryDark,
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              _buildSummaryCard(context, 'Income', income, VelanTheme.success, Icons.arrow_downward),
                              const SizedBox(width: 12),
                              _buildSummaryCard(context, 'Remaining', budgetRemaining, VelanTheme.accentBright, Icons.account_balance_wallet_outlined),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ─── Transactions List ──────────────────────────
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Recent Transactions',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: transactions.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.receipt_long_outlined, size: 48,
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                                const SizedBox(height: 12),
                                const Text('No transactions yet'),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: transactions.length,
                            itemBuilder: (context, index) {
                              final t = transactions[index];
                              final isIncome = t.type == 'credit';
                              final canModify = userRole == UserRole.head || userRole == UserRole.manager;

                              Widget card = Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(10),
                                        decoration: BoxDecoration(
                                          color: (isIncome
                                                  ? VelanTheme.success
                                                  : VelanTheme.highlight)
                                              .withOpacity(0.15),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          isIncome
                                              ? Icons.arrow_downward
                                              : Icons.arrow_upward,
                                          color: isIncome
                                              ? VelanTheme.success
                                              : VelanTheme.highlight,
                                          size: 20,
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(t.category,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                                            const SizedBox(height: 4),
                                            Text(
                                              '${FormatUtils.formatDate(t.date)} • ${t.paymentMethod}',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodySmall?.copyWith(color: Colors.grey.shade600),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (t.proofUrl.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(right: 8),
                                          child: InkWell(
                                            onTap: () => _showProofDialog(context, t.proofUrl, t.category),
                                            borderRadius: BorderRadius.circular(6),
                                            child: Container(
                                              padding: const EdgeInsets.all(6),
                                              decoration: BoxDecoration(
                                                color: Colors.blue.shade50,
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Icon(Icons.receipt_long, size: 18, color: Colors.blue.shade700),
                                            ),
                                          ),
                                        ),
                                      Text(
                                        '${isIncome ? '+' : '-'}${FormatUtils.formatCurrency(t.amount)}',
                                        style: TextStyle(
                                          color: isIncome
                                              ? VelanTheme.success
                                              : VelanTheme.primaryDark,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 16,
                                        ),
                                      ),
                                      if (canModify)
                                        PopupMenuButton<String>(
                                          padding: EdgeInsets.zero,
                                          iconSize: 20,
                                          onSelected: (val) {
                                            if (val == 'delete') {
                                              _confirmDeleteExpense(context, ref, t.id);
                                            }
                                          },
                                          itemBuilder: (context) => [
                                            const PopupMenuItem(value: 'delete', child: Text('Delete')),
                                          ],
                                        ),
                                    ],
                                  ),
                                ),
                              );

                              if (canModify) {
                                card = Dismissible(
                                  key: ValueKey(t.id),
                                  direction: DismissDirection.endToStart,
                                  background: Container(
                                    alignment: Alignment.centerRight,
                                    padding: const EdgeInsets.only(right: 24),
                                    margin: const EdgeInsets.only(bottom: 12),
                                    decoration: BoxDecoration(
                                      color: Colors.red.shade400,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(Icons.delete_outline, color: Colors.white),
                                  ),
                                  confirmDismiss: (direction) async {
                                    return await showConfirmBottomSheet(
                                      context,
                                      title: 'Delete Transaction?',
                                      message: 'This action cannot be undone.',
                                      confirmLabel: 'Delete',
                                      confirmColor: Colors.red,
                                    ) ?? false;
                                  },
                                  onDismissed: (direction) {
                                    ref.read(projectRepositoryProvider).deleteExpense(projectId, t.id);
                                  },
                                  child: card,
                                );
                              }

                              return card;
                            },
                          ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildSummaryCard(
      BuildContext context, String label, double amount, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Text(label,
                    style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              FormatUtils.formatCurrency(amount),
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteExpense(BuildContext context, WidgetRef ref, String expenseId) async {
    final confirm = await showConfirmBottomSheet(
      context,
      title: 'Delete Transaction?',
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      confirmColor: Colors.red,
    );
    if (confirm == true) {
      ref.read(projectRepositoryProvider).deleteExpense(projectId, expenseId);
    }
  }
}
