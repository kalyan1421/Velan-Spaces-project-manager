import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

class RoomsTab extends ConsumerWidget {
  const RoomsTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(projectRoomsProvider(projectId));

    return roomsAsync.when(
      data: (rooms) {
        if (rooms.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.room_preferences_outlined, size: 48,
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3)),
                const SizedBox(height: 12),
                const Text('No rooms defined yet'),
              ],
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: rooms.length,
          itemBuilder: (context, index) {
            final room = rooms[index];
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: VelanTheme.accentBright.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.room_preferences,
                      color: VelanTheme.accentBright, size: 20),
                ),
                title: Text(room.name),
                subtitle: Text('${room.assignedWorkerIds.length} workers assigned'),
                trailing: const Icon(Icons.chevron_right, size: 18),
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }
}
