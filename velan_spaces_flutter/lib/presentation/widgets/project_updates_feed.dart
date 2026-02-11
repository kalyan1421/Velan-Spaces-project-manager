import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class ProjectUpdatesFeed extends ConsumerWidget {
  const ProjectUpdatesFeed({required this.projectId, super.key});

  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final updatesAsync = ref.watch(projectUpdatesProvider(projectId));

    return updatesAsync.when(
      data: (updates) {
        if (updates.isEmpty) {
          return const Center(
            child: Text('No updates for this project yet.'),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(8),
          itemCount: updates.length,
          itemBuilder: (context, index) {
            final update = updates[index];
            return Card(
              elevation: 2,
              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          update.type == 'photo'
                              ? Icons.photo_camera
                              : update.type == 'video'
                                  ? Icons.videocam
                                  : Icons.chat_bubble,
                          size: 16,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          update.postedBy,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          DateFormat.yMMMd().add_jm().format(update.timestamp),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if(update.content.isNotEmpty) Text(update.content),
                  ],
                ),
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, stack) => Center(child: Text('Error: $err')),
    );
  }
}
