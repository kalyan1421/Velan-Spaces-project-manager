import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:intl/intl.dart';

class BudgetTab extends ConsumerWidget {
  const BudgetTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final budgetAsync = ref.watch(projectExpensesProvider(projectId));
    final projectAsync = ref.watch(projectDetailProvider(projectId));

    return projectAsync.when(
      data: (project) => budgetAsync.when(
        data: (transactions) {
          final income = transactions
              .where((t) => t.type == 'credit') // Changed from 'income'
              .fold<double>(0, (s, t) => s + t.amount);
          final expense = transactions
              .where((t) => t.type == 'debit') // Changed from 'expense'
              .fold<double>(0, (s, t) => s + t.amount);

          return Column(
            children: [
              // ─── Summary ────────────────────────────────────
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    _buildSummaryCard(context, 'Budget', project.budget, VelanTheme.accent),
                    const SizedBox(width: 8),
                    _buildSummaryCard(context, 'Income', income, VelanTheme.success),
                    const SizedBox(width: 8),
                    _buildSummaryCard(context, 'Expense', expense, VelanTheme.highlight),
                  ],
                ),
              ),

              // ─── Transactions List ──────────────────────────
              Expanded(
                child: transactions.isEmpty
                    ? const Center(child: Text('No expenses recorded'))
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: transactions.length,
                        itemBuilder: (context, index) {
                          final t = transactions[index];
                          final isIncome = t.type == 'credit';

                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: (isIncome
                                              ? VelanTheme.success
                                              : VelanTheme.highlight)
                                          .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Icon(
                                      isIncome
                                          ? Icons.arrow_downward
                                          : Icons.arrow_upward,
                                      color: isIncome
                                          ? VelanTheme.success
                                          : VelanTheme.highlight,
                                      size: 18,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(t.category,
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium),
                                        Text(
                                          '${DateFormat('MMM dd, yyyy').format(t.date)} • ${t.paymentMethod}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${isIncome ? '+' : '-'}₹${NumberFormat('#,##,###').format(t.amount)}',
                                    style: TextStyle(
                                      color: isIncome
                                          ? VelanTheme.success
                                          : VelanTheme.highlight,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }

  Widget _buildSummaryCard(
      BuildContext context, String label, double amount, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(label,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: color)),
            const SizedBox(height: 4),
            Text(
              '₹${_formatAmount(amount)}',
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatAmount(double amount) {
    if (amount >= 100000) {
      return '${(amount / 100000).toStringAsFixed(1)}L';
    } else if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(1)}K';
    }
    return amount.toStringAsFixed(0);
  }
}
