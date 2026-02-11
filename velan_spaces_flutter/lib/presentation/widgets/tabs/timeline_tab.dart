import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class TimelineTab extends ConsumerWidget {
  const TimelineTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectAsync = ref.watch(projectDetailProvider(projectId));

    return projectAsync.when(
      data: (project) {
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Overall progress
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Overall Progress',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: LinearProgressIndicator(
                                value: project.completionPercentage / 100,
                                minHeight: 10,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            '${project.completionPercentage}%',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: VelanTheme.highlight,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (project.startDate != null)
                            _buildDateChip(context, 'Start', project.startDate!),
                          if (project.targetEndDate != null)
                            _buildDateChip(context, 'Target', project.targetEndDate!),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Project Status',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      _buildInfoRow(context, 'Status',
                          project.isComplete ? 'Completed' : 'In Progress'),
                      const Divider(height: 20),
                      _buildInfoRow(context, 'Budget',
                          '₹${project.budget.toStringAsFixed(0)}'),
                      const Divider(height: 20),
                      _buildInfoRow(context, 'Spent',
                          '₹${project.currentSpend.toStringAsFixed(0)}'),
                      const Divider(height: 20),
                      _buildInfoRow(context, 'Remaining',
                          '₹${(project.budget - project.currentSpend).toStringAsFixed(0)}'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }

  Widget _buildDateChip(BuildContext context, String label, DateTime date) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: VelanTheme.accent.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.calendar_today, size: 12, color: VelanTheme.accent),
          const SizedBox(width: 4),
          Text(
            '$label: ${date.day}/${date.month}/${date.year}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
        Text(value, style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}
