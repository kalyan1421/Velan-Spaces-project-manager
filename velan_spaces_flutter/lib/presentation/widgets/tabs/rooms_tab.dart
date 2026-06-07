import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/common/async_value_widget.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/assign_workers_sheet.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/add_room_dialog.dart';

class RoomsTab extends ConsumerWidget {
  const RoomsTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(projectRoomsProvider(projectId));

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'rooms_fab',
        onPressed: () {
          showFormBottomSheet(
            context: context,
            title: 'Add Room',
            child: AddRoomSheet(projectId: projectId),
          );
        },
        backgroundColor: VelanTheme.highlight,
        label: const Text(
          'Add Room',
          style: TextStyle(
            color: VelanTheme.primaryDark,
            fontWeight: FontWeight.bold,
          ),
        ),
        icon: const Icon(Icons.add, color: VelanTheme.primaryDark),
      ),
      body: AsyncValueWidget(
        value: roomsAsync,
        emptyMessage: 'No rooms defined yet',
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
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.person_add_alt_1, size: 20),
                        tooltip: 'Assign workers',
                        onPressed: () {
                          showModalBottomSheet(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: Colors.transparent,
                            builder: (context) => Padding(
                              padding: EdgeInsets.only(
                                bottom: MediaQuery.of(context).viewInsets.bottom,
                              ),
                              child: FractionallySizedBox(
                                heightFactor: 0.8,
                                child: AssignWorkersSheet(
                                  projectId: projectId,
                                  room: room,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                      PopupMenuButton<String>(
                        onSelected: (val) {
                          if (val == 'edit') {
                            _showEditRoomDialog(context, ref, room.id, room.name);
                          } else if (val == 'delete') {
                            _confirmDeleteRoom(context, ref, room.id, room.name);
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(value: 'edit', child: Text('Rename Room')),
                          const PopupMenuItem(value: 'delete', child: Text('Delete Room')),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showEditRoomDialog(BuildContext context, WidgetRef ref, String roomId, String currentName) {
    final controller = TextEditingController(text: currentName);
    showFormBottomSheet(
      context: context,
      title: 'Rename Room',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: controller,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Room Name',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.room_preferences_outlined),
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () async {
              final newName = controller.text.trim();
              if (newName.isEmpty) return;
              Navigator.pop(context);
              await ref.read(projectRepositoryProvider).updateRoom(
                projectId, roomId, {'name': newName},
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteRoom(BuildContext context, WidgetRef ref, String roomId, String name) async {
    final confirm = await showConfirmBottomSheet(
      context,
      title: 'Delete Room?',
      message: 'Are you sure you want to delete "$name"? This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmColor: Colors.red,
    );
    if (confirm == true) {
      try {
        final repo = ref.read(projectRepositoryProvider);
        await repo.deleteRoom(projectId, roomId);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e')),
          );
        }
      }
    }
  }
}

