import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/room_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/common/async_value_widget.dart';

class AssignWorkersSheet extends ConsumerStatefulWidget {
  final String projectId;
  final RoomEntity room;

  const AssignWorkersSheet({
    required this.projectId,
    required this.room,
    super.key,
  });

  @override
  ConsumerState<AssignWorkersSheet> createState() => _AssignWorkersSheetState();
}

class _AssignWorkersSheetState extends ConsumerState<AssignWorkersSheet> {
  late Set<String> _selectedWorkerIds;

  @override
  void initState() {
    super.initState();
    _selectedWorkerIds = Set.from(widget.room.assignedWorkerIds);
  }

  Future<void> _save() async {
    final success = await ref.read(roomUpdateControllerProvider.notifier)
        .assignWorkersToRoom(widget.projectId, widget.room.id, _selectedWorkerIds.toList());
    
    if (success && mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Workers assigned to ${widget.room.name}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final workersAsync = ref.watch(validProjectWorkersProvider(widget.projectId));
    final updateState = ref.watch(roomUpdateControllerProvider);

    return Container(
      padding: const EdgeInsets.only(top: 16),
      decoration: const BoxDecoration(
        color: VelanTheme.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Assign to ${widget.room.name}',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                )
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: AsyncValueWidget(
              value: workersAsync,
              emptyMessage: 'No workers assigned to this project yet.',
              data: (workers) {
                if (workers.isEmpty) {
                  return const Center(child: Text('No workers available.'));
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  itemCount: workers.length,
                  itemBuilder: (context, index) {
                    final worker = workers[index];
                    final isSelected = _selectedWorkerIds.contains(worker.id);

                    return CheckboxListTile(
                      activeColor: VelanTheme.highlight,
                      title: Text(worker.name),
                      subtitle: worker.trade.isNotEmpty ? Text(worker.trade) : null,
                      value: isSelected,
                      onChanged: (bool? value) {
                        setState(() {
                          if (value == true) {
                            _selectedWorkerIds.add(worker.id);
                          } else {
                            _selectedWorkerIds.remove(worker.id);
                          }
                        });
                      },
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: updateState.isLoading ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: VelanTheme.highlight,
                    foregroundColor: VelanTheme.primaryDark,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: updateState.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: VelanTheme.primaryDark,
                          ),
                        )
                      : const Text(
                          'Save Assignments',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
