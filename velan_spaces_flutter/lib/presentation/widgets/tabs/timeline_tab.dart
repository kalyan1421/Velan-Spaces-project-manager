import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/timeline_provider.dart';

class TimelineTab extends ConsumerWidget {
  const TimelineTab({required this.projectId, super.key});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timelineAsync = ref.watch(timelineProvider(projectId));

    return Column(
      children: [
        _TimelineHeader(projectId: projectId),
        Expanded(
          child: timelineAsync.when(
            data: (phases) => phases.isEmpty 
                ? _EmptyTimelineState(projectId: projectId) 
                : _TimelineContent(projectId: projectId, phases: phases),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Error: $err')),
          ),
        ),
      ],
    );
  }
}

class _TimelineHeader extends ConsumerWidget {
  final String projectId;
  const _TimelineHeader({required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: Colors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Project Timeline', 
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              Text('Track phases and sub-works', 
                style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          ElevatedButton.icon(
            icon: const Icon(Icons.save, size: 18),
            label: const Text("Save All"),
            style: ElevatedButton.styleFrom(
              backgroundColor: VelanTheme.highlight,
              foregroundColor: Colors.white,
            ),
            onPressed: () => ref.read(timelineProvider(projectId).notifier).saveAll(),
          )
        ],
      ),
    );
  }
}

class _TimelineContent extends StatelessWidget {
  final String projectId;
  final List<TimelinePhaseEntity> phases;

  const _TimelineContent({required this.projectId, required this.phases});

  @override
  Widget build(BuildContext context) {
    // Overall Stats
    final totalPhases = phases.length;
    final completedPhases = phases.where((p) => p.status == PhaseStatus.completed).length;
    final totalTasks = phases.fold(0, (sum, p) => sum + p.tasks.length);
    final completedTasks = phases.fold(0, (sum, p) => sum + p.tasks.where((t) => t.status == TaskStatus.done).length);
    
    double overallProgress = 0;
    if (totalTasks > 0) overallProgress = completedTasks / totalTasks;
    else if (totalPhases > 0) overallProgress = completedPhases / totalPhases;

    return SingleChildScrollView(
      child: Column(
        children: [
          // Progress Block
          Card(
            margin: const EdgeInsets.all(16),
            color: VelanTheme.highlight,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      CircularProgressIndicator(
                        value: overallProgress,
                        backgroundColor: Colors.white24,
                        color: Colors.white,
                        strokeWidth: 6,
                      ),
                      Text('${(overallProgress * 100).toInt()}%',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)),
                    ],
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Overall Progress', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text('$completedPhases of $totalPhases phases completed', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      Text('$completedTasks tasks done', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  )
                ],
              ),
            ),
          ),

          // Phase List (Reorderable)
          // Note: ReorderableListView inside SingleChildScrollView can be tricky. 
          // For MVP using a standard List + standard mapping.
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: phases.length,
            itemBuilder: (context, index) {
              return _PhaseCard(projectId: projectId, phase: phases[index], index: index + 1);
            },
          ),
          
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
            onPressed: () => _showAddPhaseBottomSheet(context, projectId),
              icon: const Icon(Icons.add),
              label: const Text("Add New Phase"),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                side: BorderSide(color: VelanTheme.highlight),
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _PhaseCard extends ConsumerWidget {
  final String projectId;
  final TimelinePhaseEntity phase;
  final int index;

  const _PhaseCard({required this.projectId, required this.phase, required this.index});

  Color _getStatusColor(PhaseStatus status) {
    switch(status) {
      case PhaseStatus.completed: return Colors.green;
      case PhaseStatus.inProgress: return Colors.orange;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dateFormat = DateFormat('MMM d');
    
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 2,
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(phase.status).withOpacity(0.1),
          child: Text('$index', 
            style: TextStyle(color: _getStatusColor(phase.status), fontWeight: FontWeight.bold)),
        ),
        title: Text(phase.name, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Row(
              children: [
                _StatusChip(label: phase.status.name.toUpperCase(), color: _getStatusColor(phase.status)),
                if (phase.isOverdue) ...[
                  const SizedBox(width: 8),
                  Text("${phase.overdueDays} days overdue", 
                      style: const TextStyle(color: Colors.red, fontSize: 11, fontWeight: FontWeight.bold)),
                ]
              ],
            ),
            const SizedBox(height: 4),
            Text('${dateFormat.format(phase.startDate)} - ${dateFormat.format(phase.endDate)}',
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
            if (phase.notes != null && phase.notes!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(phase.notes!, style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.black54)),
            ]
          ],
        ),
        trailing: PopupMenuButton(
          itemBuilder: (context) => [
            const PopupMenuItem(value: 'edit', child: Text('Edit Phase')),
            if (phase.status != PhaseStatus.completed)
              const PopupMenuItem(value: 'complete', child: Text('Mark Complete')),
            const PopupMenuItem(value: 'delete', child: Text('Delete Phase')),
          ],
          onSelected: (val) {
            if (val == 'delete') {
              ref.read(timelineProvider(projectId).notifier).removePhase(phase.id);
            } else if (val == 'edit') {
              _showEditPhaseBottomSheet(context, ref, projectId, phase);
            } else if (val == 'complete') {
              // Check if tasks are done? 
              // For now, allow force complete but maybe show snackbar if tasks pending?
              // The provider logic is simple, UI can just call it.
              if (phase.tasks.any((t) => t.status != TaskStatus.done)) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Warning: Some tasks are not finished yet.")));
              }
              ref.read(timelineProvider(projectId).notifier).markPhaseComplete(phase.id);
            }
          },
        ),
        children: [
          // Task List
          if (phase.tasks.isEmpty)
             const Padding(padding: EdgeInsets.all(16), child: Text("No tasks added.", style: TextStyle(color: Colors.grey))),
          
          ...phase.tasks.map((task) => CheckboxListTile(
            title: Text(task.title, style: TextStyle(
              decoration: task.status == TaskStatus.done ? TextDecoration.lineThrough : null,
              color: task.status == TaskStatus.done ? Colors.grey : Colors.black87
            )),
            value: task.status == TaskStatus.done,
            // Subtitle for task details (worker, planned dates) could go here later
            onChanged: (val) {
              ref.read(timelineProvider(projectId).notifier).toggleTaskStatus(phase.id, task.id);
            },
            controlAffinity: ListTileControlAffinity.leading,
            dense: true,
          )),
          
          // Add Task Button
          ListTile(
            leading: const Icon(Icons.add_circle_outline),
            title: const Text("Add Task"),
            onTap: () => _showAddTaskBottomSheet(context, ref, projectId, phase.id),
          )
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.3))
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}

class _EmptyTimelineState extends StatelessWidget {
  final String projectId;
  const _EmptyTimelineState({required this.projectId});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.timeline, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          const Text("No phases added yet", style: TextStyle(fontSize: 18, color: Colors.grey)),
          const SizedBox(height: 8),
          const Text("Start by adding a phase.", style: TextStyle(color: Colors.grey)),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _showAddPhaseBottomSheet(context, projectId),
            icon: const Icon(Icons.add),
            label: const Text("Add New Phase"),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              side: BorderSide(color: VelanTheme.highlight),
            ),
          ),
        ],
      ),
    );
  }
}

// --- Bottom Sheets ---

void _showAddPhaseBottomSheet(BuildContext context, String projectId) {
  final formKey = GlobalKey<FormState>();
  final nameCtrl = TextEditingController();
  final notesCtrl = TextEditingController();
  DateTime start = DateTime.now();
  DateTime end = DateTime.now().add(const Duration(days: 7));

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text("Add New Phase", style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: "Phase Name", hintText: "e.g. Foundation Work", border: OutlineInputBorder()),
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: notesCtrl,
                decoration: const InputDecoration(labelText: "Notes (Optional)", hintText: "e.g. Needs extra cement", border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () async {
                        final d = await showDatePicker(context: context, initialDate: start, firstDate: DateTime(2020), lastDate: DateTime(2030));
                        if(d != null) setState(() => start = d);
                      },
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: "Start Date", border: OutlineInputBorder()),
                        child: Text(DateFormat('MMM d').format(start)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: () async {
                        final d = await showDatePicker(context: context, initialDate: end, firstDate: DateTime(2020), lastDate: DateTime(2030));
                        if(d != null) setState(() => end = d);
                      },
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: "End Date", border: OutlineInputBorder()),
                        child: Text(DateFormat('MMM d').format(end)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Consumer(
                builder: (context, ref, _) {
                  return ElevatedButton(
                    onPressed: () {
                      if (formKey.currentState!.validate()) {
                        if (end.isBefore(start)) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("End date cannot be before start date")));
                          return;
                        }
                        ref.read(timelineProvider(projectId).notifier).addPhase(nameCtrl.text, start, end, notes: notesCtrl.text);
                        Navigator.pop(context);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: VelanTheme.highlight,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text("Add Phase"),
                  );
                }
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    ),
  );
}

void _showEditPhaseBottomSheet(BuildContext context, WidgetRef ref, String projectId, TimelinePhaseEntity phase) {
  final formKey = GlobalKey<FormState>();
  final nameCtrl = TextEditingController(text: phase.name);
  final notesCtrl = TextEditingController(text: phase.notes);
  DateTime start = phase.startDate;
  DateTime end = phase.endDate;

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text("Edit Phase", style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: "Phase Name", border: OutlineInputBorder()),
                validator: (v) => v!.isEmpty ? "Required" : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: notesCtrl,
                decoration: const InputDecoration(labelText: "Notes", border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () async {
                        final d = await showDatePicker(context: context, initialDate: start, firstDate: DateTime(2020), lastDate: DateTime(2030));
                        if(d != null) setState(() => start = d);
                      },
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: "Start Date", border: OutlineInputBorder()),
                        child: Text(DateFormat('MMM d').format(start)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: () async {
                        final d = await showDatePicker(context: context, initialDate: end, firstDate: DateTime(2020), lastDate: DateTime(2030));
                        if(d != null) setState(() => end = d);
                      },
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: "End Date", border: OutlineInputBorder()),
                        child: Text(DateFormat('MMM d').format(end)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  if (formKey.currentState!.validate()) {
                    if (end.isBefore(start)) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("End date cannot be before start date")));
                      return;
                    }
                    ref.read(timelineProvider(projectId).notifier).updatePhase(
                      phase.id, 
                      name: nameCtrl.text, 
                      start: start, 
                      end: end, 
                      notes: notesCtrl.text
                    );
                    Navigator.pop(context);
                  }
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: VelanTheme.highlight, // Keep consistent buttons
                  foregroundColor: Colors.white,
                ),
                child: const Text("Save Changes"),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    ),
  );
}

void _showAddTaskBottomSheet(BuildContext context, WidgetRef ref, String projectId, String phaseId) {
  final formKey = GlobalKey<FormState>();
  final titleCtrl = TextEditingController();
  final descCtrl = TextEditingController();
  DateTime start = DateTime.now();
  DateTime end = DateTime.now().add(const Duration(days: 2));

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16,
          right: 16,
          top: 16,
        ),
        child: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                   Text("Add Task to Phase", style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                   IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context))
                ],
              ),
              const SizedBox(height: 16),
              const Text("TASK TITLE *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
              const SizedBox(height: 8),
              TextFormField(
                controller: titleCtrl,
                decoration: InputDecoration(
                  hintText: "e.g., Pour concrete, Install rebar", 
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                validator: (v) => v!.isEmpty ? "Required" : null,
                autofocus: true,
              ),
              const SizedBox(height: 16),
              const Text("DESCRIPTION", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
              const SizedBox(height: 8),
              TextFormField(
                controller: descCtrl,
                decoration: InputDecoration(
                  hintText: "Task details...",
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("START DATE", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () async {
                            final d = await showDatePicker(context: context, initialDate: start, firstDate: DateTime(2020), lastDate: DateTime(2030));
                            if(d != null) setState(() => start = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade400),
                              borderRadius: BorderRadius.circular(8)
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(DateFormat('dd/MM/yyyy').format(start)),
                                const Icon(Icons.calendar_today, size: 16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("TARGET DATE *", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () async {
                            final d = await showDatePicker(context: context, initialDate: end, firstDate: DateTime(2020), lastDate: DateTime(2030));
                            if(d != null) setState(() => end = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade400),
                              borderRadius: BorderRadius.circular(8)
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(DateFormat('dd/MM/yyyy').format(end)),
                                const Icon(Icons.calendar_today, size: 16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context), 
                    style: TextButton.styleFrom(foregroundColor: Colors.grey),
                    child: const Text("Cancel"),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton(
                    onPressed: () {
                      if (formKey.currentState!.validate()) {
                        if (end.isBefore(start)) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("End date cannot be before start date")));
                          return;
                        }
                        ref.read(timelineProvider(projectId).notifier).addTask(
                          phaseId, 
                          titleCtrl.text, 
                          description: descCtrl.text,
                          plannedStart: start,
                          plannedEnd: end
                        );
                        Navigator.pop(context);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      backgroundColor: Colors.black, // Velan Theme
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text("Add Task"),
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    ),
  );
}
