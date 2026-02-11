import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class HeadDashboardScreen extends ConsumerWidget {
  const HeadDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectsAsync = ref.watch(allProjectsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Velan Spaces'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/create-project'),
        icon: const Icon(Icons.add),
        label: const Text('New Project'),
      ),
      body: projectsAsync.when(
        data: (projects) {
          if (projects.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.folder_open, size: 64,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                  const SizedBox(height: 16),
                  Text('No projects yet',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text('Tap + to create your first project',
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.only(top: 8, bottom: 100),
            itemCount: projects.length,
            itemBuilder: (context, index) {
              final project = projects[index];
              final spent = project.currentSpend;
              final budget = project.budget;
              final progress = project.completionPercentage / 100;

              return Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => context.push('/project/${project.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(project.projectName,
                                  style: Theme.of(context).textTheme.titleLarge),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: project.isComplete
                                    ? VelanTheme.success.withOpacity(0.15)
                                    : VelanTheme.highlight.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                project.isComplete ? 'Done' : '${project.completionPercentage}%',
                                style: TextStyle(
                                  color: project.isComplete
                                      ? VelanTheme.success
                                      : VelanTheme.highlight,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.person_outline, size: 14,
                                color: Theme.of(context).textTheme.bodyMedium?.color),
                            const SizedBox(width: 4),
                            Text(project.clientName,
                                style: Theme.of(context).textTheme.bodyMedium),
                            const SizedBox(width: 16),
                            Icon(Icons.location_on_outlined, size: 14,
                                color: Theme.of(context).textTheme.bodyMedium?.color),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(project.location,
                                  style: Theme.of(context).textTheme.bodyMedium,
                                  overflow: TextOverflow.ellipsis),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progress.clamp(0.0, 1.0),
                            minHeight: 4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Budget: ₹${_formatAmount(budget)}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            Text(
                              'Spent: ₹${_formatAmount(spent)}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: spent > budget
                                        ? Colors.red
                                        : null,
                                  ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
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
