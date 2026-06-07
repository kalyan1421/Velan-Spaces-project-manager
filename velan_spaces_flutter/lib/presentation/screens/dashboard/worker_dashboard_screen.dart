import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/timeline_provider.dart';

class WorkerDashboardScreen extends ConsumerWidget {
  const WorkerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(currentUserMetaProvider);
    final workerName = meta['name'] as String? ?? 'Worker';
    final assignedTasksAsync = ref.watch(workerAssignedTasksProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text('Hi, $workerName'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_outlined),
            tooltip: 'Sign out',
            onPressed: () => ref.read(authNotifierProvider.notifier).signOut(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: assignedTasksAsync.when(
        data: (assignedTasks) {
          if (assignedTasks.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.assignment_turned_in_outlined,
                      size: 64, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text('No assigned tasks',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    'Tasks assigned to you will appear here',
                    style: Theme.of(context).textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }

          final pendingCount =
              assignedTasks.where((item) => item.task.status == TaskStatus.pending).length;
          final inProgressCount = assignedTasks
              .where((item) => item.task.status == TaskStatus.inProgress)
              .length;
          final overdueCount =
              assignedTasks.where((item) => item.task.isOverdue).length;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: _SummaryCard(
                      label: 'Pending',
                      value: pendingCount.toString(),
                      color: Colors.orange,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SummaryCard(
                      label: 'In Progress',
                      value: inProgressCount.toString(),
                      color: Colors.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _SummaryCard(
                      label: 'Overdue',
                      value: overdueCount.toString(),
                      color: Colors.red,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'Assigned Tasks',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              ...assignedTasks.map(
                (assignment) => Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    assignment.task.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${assignment.project.projectName} • ${assignment.phase.name}',
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                  if (assignment.roomName != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Room: ${assignment.roomName}',
                                      style: Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            _TaskStatusChip(status: assignment.task.status),
                          ],
                        ),
                        if ((assignment.task.description ?? '').isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(assignment.task.description!),
                        ],
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 12,
                          runSpacing: 8,
                          children: [
                            _MetaPill(
                              icon: Icons.event_outlined,
                              label: assignment.task.plannedEnd == null
                                  ? 'No deadline'
                                  : 'Due ${DateFormat('dd MMM').format(assignment.task.plannedEnd!)}',
                            ),
                            _MetaPill(
                              icon: Icons.checklist_rtl,
                              label:
                                  '${assignment.task.completedChecklistCount}/${assignment.task.checklistItems.length} checklist',
                            ),
                            _MetaPill(
                              icon: Icons.photo_camera_back_outlined,
                              label:
                                  '${assignment.task.photoProofUrls.length} proof files',
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            OutlinedButton(
                              onPressed: () =>
                                  context.push('/project/${assignment.project.id}'),
                              child: const Text('Open project'),
                            ),
                            const SizedBox(width: 12),
                            FilledButton(
                              onPressed: () => _showTaskActionSheet(
                                context,
                                ref,
                                assignment,
                              ),
                              child: const Text('Update task'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Error: $error')),
      ),
    );
  }

  Future<void> _showTaskActionSheet(
    BuildContext context,
    WidgetRef ref,
    AssignedProjectTaskView assignment,
  ) async {
    final commentController = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setState) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                assignment.task.title,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                children: TaskStatus.values
                    .map(
                      (status) => ChoiceChip(
                        label: Text(status.name),
                        selected: assignment.task.status == status,
                        onSelected: (_) async {
                          final updatedTask = assignment.task.copyWith(
                            status: status,
                            updatedAt: DateTime.now(),
                            actualStart: status == TaskStatus.pending
                                ? null
                                : assignment.task.actualStart ?? DateTime.now(),
                            actualEnd:
                                status == TaskStatus.done ? DateTime.now() : null,
                          );
                          await ref
                              .read(timelineRepositoryProvider)
                              .updateTask(
                                assignment.project.id,
                                assignment.phase.id,
                                updatedTask,
                              );
                          ref.invalidate(workerAssignedTasksProvider);
                          ref.invalidate(timelineProvider(assignment.project.id));
                          if (!context.mounted) return;
                          Navigator.of(sheetContext).pop();
                        },
                      ),
                    )
                    .toList(),
              ),
              if (assignment.task.checklistItems.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  'Checklist',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                ...assignment.task.checklistItems.map(
                  (item) => CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: item.isDone,
                    title: Text(item.label),
                    onChanged: (_) async {
                      await ref.read(timelineRepositoryProvider).toggleChecklistItem(
                            assignment.project.id,
                            assignment.phase.id,
                            assignment.task.id,
                            item.id,
                          );
                      ref.invalidate(workerAssignedTasksProvider);
                      ref.invalidate(timelineProvider(assignment.project.id));
                      if (context.mounted) {
                        Navigator.of(sheetContext).pop();
                      }
                    },
                  ),
                ),
              ],
              const SizedBox(height: 16),
              TextField(
                controller: commentController,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Add task comment',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: () async {
                      final result = await FilePicker.platform.pickFiles(withData: false);
                      if (result == null || result.files.isEmpty) return;
                      final path = result.files.single.path;
                      if (path == null) return;
                      final uploaded = await ref
                          .read(storageDatasourceProvider)
                          .uploadFile(
                            path,
                            'projects/${assignment.project.id}/timeline/${assignment.task.id}',
                          );
                      await ref.read(timelineRepositoryProvider).addTaskPhotoProof(
                            assignment.project.id,
                            assignment.phase.id,
                            assignment.task.id,
                            uploaded,
                          );
                      ref.invalidate(workerAssignedTasksProvider);
                      ref.invalidate(timelineProvider(assignment.project.id));
                      if (context.mounted) {
                        Navigator.of(sheetContext).pop();
                      }
                    },
                    icon: const Icon(Icons.photo_camera_back_outlined),
                    label: const Text('Upload proof'),
                  ),
                  const SizedBox(width: 12),
                  FilledButton(
                    onPressed: () async {
                      if (commentController.text.trim().isEmpty) return;
                      final meta = ref.read(currentUserMetaProvider);
                      await ref.read(timelineRepositoryProvider).addTaskComment(
                            assignment.project.id,
                            assignment.phase.id,
                            assignment.task.id,
                            TaskCommentEntity(
                              id: DateTime.now().millisecondsSinceEpoch.toString(),
                              text: commentController.text.trim(),
                              postedBy: meta['name'] as String? ?? 'Worker',
                              postedById: meta['id'] as String? ?? '',
                              createdAt: DateTime.now(),
                            ),
                          );
                      ref.invalidate(workerAssignedTasksProvider);
                      ref.invalidate(timelineProvider(assignment.project.id));
                      if (context.mounted) {
                        Navigator.of(sheetContext).pop();
                      }
                    },
                    child: const Text('Post comment'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
          ),
          const SizedBox(height: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _TaskStatusChip extends StatelessWidget {
  const _TaskStatusChip({required this.status});

  final TaskStatus status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      TaskStatus.pending => Colors.orange,
      TaskStatus.inProgress => Colors.blue,
      TaskStatus.blocked => Colors.red,
      TaskStatus.done => Colors.green,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.name,
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
    );
  }
}
