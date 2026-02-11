import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/project_detail_screen.dart';

class WorkerDashboardScreen extends ConsumerWidget {
  const WorkerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(currentUserMetaProvider);
    final workerName = meta['name'] ?? 'Worker';
    final projectsAsync = ref.watch(allProjectsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, $workerName'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
          ),
        ],
      ),
      body: projectsAsync.when(
        data: (projects) {
          // Filter projects where this worker is assigned
          final workerId = meta['id'] as String? ?? '';
          final myProjects = projects
              .where((p) => p.workerIds.contains(workerId))
              .toList();

          if (myProjects.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.engineering_outlined, size: 64,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                  const SizedBox(height: 16),
                  Text('No assigned projects',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text('Projects you are assigned to will appear here',
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.only(top: 8, bottom: 24),
            itemCount: myProjects.length,
            itemBuilder: (context, index) {
              final project = myProjects[index];
              return Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  title: Text(project.projectName,
                      style: Theme.of(context).textTheme.titleMedium),
                  subtitle: Text('${project.location}',
                      style: Theme.of(context).textTheme.bodySmall),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ProjectDetailScreen(projectId: project.id),
                      ),
                    );
                  },
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
}
