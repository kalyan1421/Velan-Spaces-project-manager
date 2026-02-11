import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class ManagerDashboardScreen extends ConsumerWidget {
  const ManagerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectsAsync = ref.watch(managerProjectsProvider);
    final meta = ref.watch(currentUserMetaProvider);
    final managerName = meta['name'] ?? 'Manager';

    return Scaffold(
      appBar: AppBar(
        title: Text('Hi, $managerName'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
          ),
        ],
      ),
      body: projectsAsync.when(
        data: (projects) {
          if (projects.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.assignment_outlined, size: 64,
                      color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                  const SizedBox(height: 16),
                  Text('No assigned projects',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text('Projects assigned to you will appear here',
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.only(top: 8, bottom: 24),
            itemCount: projects.length,
            itemBuilder: (context, index) {
              final project = projects[index];
              return Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.all(16),
                  title: Text(project.projectName,
                      style: Theme.of(context).textTheme.titleMedium),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text('${project.clientName} • ${project.location}',
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: project.completionPercentage / 100,
                        minHeight: 3,
                      ),
                    ],
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: VelanTheme.highlight.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('${project.completionPercentage}%',
                        style: const TextStyle(
                            color: VelanTheme.highlight,
                            fontWeight: FontWeight.w600,
                            fontSize: 12)),
                  ),
                  onTap: () => context.push('/project/${project.id}'),
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
