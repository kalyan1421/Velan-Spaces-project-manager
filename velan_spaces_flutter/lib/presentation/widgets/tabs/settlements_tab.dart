import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/add_settlement_dialog.dart';
import 'package:intl/intl.dart';

class SettlementsTab extends ConsumerWidget {
  const SettlementsTab({required this.projectId, super.key});
  final String projectId;

  static void _showProofDialog(BuildContext context, String proofUrl, String title) {
    showProofBottomSheet(context, proofUrl, title);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settlementsAsync = ref.watch(projectSettlementsProvider(projectId));
    final userRole = ref.watch(currentUserRoleProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: (userRole == UserRole.head || userRole == UserRole.manager)
          ? FloatingActionButton(
              heroTag: 'settlements_fab',
              onPressed: () {
                showFormBottomSheet(
                  context: context,
                  title: 'Add Settlement',
                  child: AddSettlementDialog(projectId: projectId),
                );
              },
              child: const Icon(Icons.add),
            )
          : null,
      body: settlementsAsync.when(
      data: (settlements) {
        final totalSettled =
            settlements.fold<double>(0, (sum, s) => sum + s.amount);

        return Column(
          children: [
            // Summary card
            Container(
              width: double.infinity,
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    VelanTheme.accentBright.withOpacity(0.15),
                    VelanTheme.accent.withOpacity(0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: VelanTheme.divider),
              ),
              child: Column(
                children: [
                  Text('Total Settled',
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 4),
                  Text(
                    '₹${NumberFormat('#,##,###').format(totalSettled)}',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: VelanTheme.highlight,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text('${settlements.length} settlements',
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),

            // List
            Expanded(
              child: settlements.isEmpty
                  ? const Center(child: Text('No settlements recorded'))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: settlements.length,
                      itemBuilder: (context, index) {
                        final s = settlements[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: VelanTheme.highlight.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.receipt_long,
                                      color: VelanTheme.highlight, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(s.description,
                                          style: Theme.of(context).textTheme.titleMedium),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Paid to: ${s.paidTo} • ${s.paymentMethod}',
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                      Text(
                                        s.date,
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                                if (s.proofUrl.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: InkWell(
                                      onTap: () => _showProofDialog(context, s.proofUrl, s.description),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: Colors.blue.shade50,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Icon(Icons.image, size: 18, color: Colors.blue.shade700),
                                      ),
                                    ),
                                  ),
                                Text(
                                  '₹${NumberFormat('#,##,###').format(s.amount)}',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: VelanTheme.highlight,
                                    fontWeight: FontWeight.w700,
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
    );
  }
}
