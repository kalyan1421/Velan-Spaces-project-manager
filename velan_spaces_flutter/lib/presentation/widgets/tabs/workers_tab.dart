import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/create_worker_dialog.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';
import 'package:velan_spaces_flutter/core/theme.dart';

class WorkersTab extends ConsumerWidget {
  const WorkersTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectAsync = ref.watch(projectDetailProvider(projectId));
    final allWorkersAsync = ref.watch(allWorkersProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          CreateWorkerBottomSheet.show(context, projectId: projectId);
        },
        backgroundColor: VelanTheme.highlight,
        label: const Text(
          'Add Worker',
          style: TextStyle(
            color: VelanTheme.primaryDark,
            fontWeight: FontWeight.bold,
          ),
        ),
        icon: const Icon(Icons.add, color: VelanTheme.primaryDark),
      ),
      body: projectAsync.when(
        data: (project) => allWorkersAsync.when(
          data: (allWorkers) {
            final assignedWorkers = allWorkers
                .where((w) => project.workerIds.contains(w.id))
                .toList();

            if (assignedWorkers.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.people_outline,
                        size: 48,
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withOpacity(0.3)),
                    const SizedBox(height: 12),
                    const Text('No workers assigned yet'),
                  ],
                ),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              itemCount: assignedWorkers.length,
              itemBuilder: (context, index) {
                final worker = assignedWorkers[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: VelanTheme.accent.withOpacity(0.15),
                      child: Text(
                        worker.name.isNotEmpty
                            ? worker.name[0].toUpperCase()
                            : 'W',
                        style: const TextStyle(color: VelanTheme.accent),
                      ),
                    ),
                    title: Text(worker.name),
                    subtitle: Text(worker.trade ?? 'General'),
                    trailing: worker.phone != null
                        ? IconButton(
                            icon: const Icon(Icons.phone, size: 18),
                            onPressed: () {},
                          )
                        : null,
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('Error: $err')),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }
}
