import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/project_detail_screen.dart';

class ClientDashboardScreen extends ConsumerWidget {
  const ClientDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(currentUserMetaProvider);
    final projectId = meta['projectId'] as String? ?? '';
    final projectAsync = ref.watch(projectDetailProvider(projectId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Project'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
          ),
        ],
      ),
      body: projectAsync.when(
        data: (project) {
          return ProjectDetailScreen(projectId: project.id);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: VelanTheme.highlight),
                const SizedBox(height: 16),
                Text('Project not found', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text('ID: $projectId', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
                  child: const Text('Go Back'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
