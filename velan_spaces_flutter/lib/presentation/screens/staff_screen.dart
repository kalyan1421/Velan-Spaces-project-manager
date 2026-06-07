import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/manager_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/worker_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/add_manager_dialog.dart';
import 'package:velan_spaces_flutter/presentation/widgets/dialogs/edit_manager_dialog.dart';

class StaffScreen extends ConsumerStatefulWidget {
  const StaffScreen({super.key});

  @override
  ConsumerState<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends ConsumerState<StaffScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final managersAsync = ref.watch(allManagersProvider);
    final workersAsync = ref.watch(allWorkersProvider);
    final projectsAsync = ref.watch(allProjectsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Staff'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: TabBar(
            controller: _tabController,
            tabs: [
              Tab(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.supervisor_account, size: 18),
                    const SizedBox(width: 6),
                    Text('Managers (${managersAsync.valueOrNull?.length ?? 0})'),
                  ],
                ),
              ),
              Tab(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.engineering, size: 18),
                    const SizedBox(width: 6),
                    Text('Workers (${workersAsync.valueOrNull?.length ?? 0})'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'staff_fab',
        onPressed: _tabController.index == 0
            ? () => showFormBottomSheet(
                  context: context,
                  title: 'Add Manager',
                  child: const AddManagerDialog(),
                )
            : () => _showAddWorkerDialog(),
        label: Text(
          _tabController.index == 0 ? 'Add Manager' : 'Add Worker',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        icon: const Icon(Icons.person_add),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // ─── Team Overview Dashboard ────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                _buildCountCard(
                  context,
                  'Managers',
                  managersAsync.valueOrNull?.length ?? 0,
                  Icons.supervisor_account,
                  VelanTheme.primaryDark,
                ),
                const SizedBox(width: 12),
                _buildCountCard(
                  context,
                  'Workers',
                  workersAsync.valueOrNull?.length ?? 0,
                  Icons.engineering,
                  VelanTheme.highlight,
                ),
              ],
            ),
          ),

          // ─── Tab Views ─────────────────────────────────────
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Manager Tab
                _buildManagerList(managersAsync, projectsAsync),
                // Worker Tab
                _buildWorkerList(workersAsync, projectsAsync),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Manager List ──────────────────────────────────────────────────────

  Widget _buildManagerList(
    AsyncValue<List<ManagerEntity>> managersAsync,
    AsyncValue<List<ProjectEntity>> projectsAsync,
  ) {
    return managersAsync.when(
      data: (managers) {
        if (managers.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.people_outline, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 16),
                Text('No managers yet',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                const SizedBox(height: 8),
                const Text('Tap + to add your first manager',
                    style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
              ],
            ),
          );
        }

        final projects = projectsAsync.valueOrNull ?? [];

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: managers.length,
          itemBuilder: (context, index) {
            return _ManagerCard(
              manager: managers[index],
              allProjects: projects,
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }

  // ─── Worker List ───────────────────────────────────────────────────────

  Widget _buildWorkerList(
    AsyncValue<List<WorkerEntity>> workersAsync,
    AsyncValue<List<ProjectEntity>> projectsAsync,
  ) {
    return workersAsync.when(
      data: (workers) {
        if (workers.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.engineering_outlined, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 16),
                Text('No workers yet',
                    style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                const SizedBox(height: 8),
                const Text('Tap + to add your first worker',
                    style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
              ],
            ),
          );
        }

        final projects = projectsAsync.valueOrNull ?? [];

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: workers.length,
          itemBuilder: (context, index) {
            final worker = workers[index];
            // Find assigned projects
            final assignedProjects = projects
                .where((p) => p.workerIds.contains(worker.id))
                .toList();

            return _WorkerCard(
              worker: worker,
              assignedProjects: assignedProjects,
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }

  // ─── Add Worker Dialog ─────────────────────────────────────────────────

  void _showAddWorkerDialog() {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final tradeController = TextEditingController();
    final passwordController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showFormBottomSheet(
      context: context,
      title: 'Add Worker',
      child: StatefulBuilder(
        builder: (ctx, setState) => Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: nameController,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Worker Name *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.engineering),
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: passwordController,
                decoration: const InputDecoration(
                  labelText: 'Password *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
                obscureText: true,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: phoneController,
                decoration: const InputDecoration(
                  labelText: 'Phone',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: tradeController,
                decoration: const InputDecoration(
                  labelText: 'Trade / Skill',
                  hintText: 'e.g. Electrician, Plumber, Carpenter',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.build_outlined),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  Navigator.pop(ctx);
                  await ref
                      .read(workerManagerControllerProvider.notifier)
                      .addWorker(
                        name: nameController.text.trim(),
                        phone: phoneController.text.trim(),
                        trade: tradeController.text.trim(),
                        password: passwordController.text.trim(),
                      );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Worker added')));
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Add Worker'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCountCard(
    BuildContext context,
    String label,
    int count,
    IconData icon,
    Color color,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  count.toString(),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Worker Card
// ═══════════════════════════════════════════════════════════════════════════

class _WorkerCard extends ConsumerStatefulWidget {
  final WorkerEntity worker;
  final List<ProjectEntity> assignedProjects;

  const _WorkerCard({
    required this.worker,
    required this.assignedProjects,
  });

  @override
  ConsumerState<_WorkerCard> createState() => _WorkerCardState();
}

class _WorkerCardState extends ConsumerState<_WorkerCard> {
  bool _isExpanded = false;

  void _showEditDialog() {
    final nameController = TextEditingController(text: widget.worker.name);
    final phoneController = TextEditingController(text: widget.worker.phone);
    final tradeController = TextEditingController(text: widget.worker.trade);
    final passwordController = TextEditingController(text: widget.worker.password);
    final formKey = GlobalKey<FormState>();

    showFormBottomSheet(
      context: context,
      title: 'Edit Worker',
      child: StatefulBuilder(
        builder: (ctx, setState) => Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Worker Name *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.engineering),
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: passwordController,
                decoration: const InputDecoration(
                  labelText: 'Password *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
                obscureText: true,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: phoneController,
                decoration: const InputDecoration(
                  labelText: 'Phone',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: tradeController,
                decoration: const InputDecoration(
                  labelText: 'Trade / Skill',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.build_outlined),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  Navigator.pop(ctx);
                  await ref
                      .read(workerManagerControllerProvider.notifier)
                      .updateWorker(
                        workerId: widget.worker.id,
                        name: nameController.text.trim(),
                        phone: phoneController.text.trim(),
                        trade: tradeController.text.trim(),
                        password: passwordController.text.trim(),
                      );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Worker updated')));
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Save Changes'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDeleteConfirmation() async {
    final message = widget.assignedProjects.isNotEmpty
        ? 'This worker is assigned to ${widget.assignedProjects.length} project(s). They will be removed from the system.'
        : 'This action cannot be undone.';
    final confirm = await showConfirmBottomSheet(
      context,
      title: 'Remove Worker?',
      message: message,
      confirmLabel: 'Remove',
      confirmColor: Colors.red,
    );
    if (confirm == true && mounted) {
      await ref
          .read(workerManagerControllerProvider.notifier)
          .deleteWorker(widget.worker.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Worker removed')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignedCount = widget.assignedProjects.length;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 1,
      child: Column(
        children: [
          // ─── Worker Info ──────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Avatar
                CircleAvatar(
                  radius: 24,
                  backgroundColor: VelanTheme.highlight.withOpacity(0.15),
                  child: Text(
                    widget.worker.name.isNotEmpty
                        ? widget.worker.name[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 20,
                      color: VelanTheme.highlight,
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.worker.name,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      if (widget.worker.trade.isNotEmpty)
                        Row(
                          children: [
                            Icon(Icons.build_outlined, size: 14,
                                color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Text(
                              widget.worker.trade,
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 13),
                            ),
                          ],
                        ),
                      if (widget.worker.phone.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Row(
                            children: [
                              Icon(Icons.phone, size: 14,
                                  color: Colors.grey.shade500),
                              const SizedBox(width: 4),
                              Text(
                                widget.worker.phone,
                                style: TextStyle(
                                    color: Colors.grey.shade600, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Action buttons
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Project count badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: assignedCount > 0
                            ? VelanTheme.success.withOpacity(0.1)
                            : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '$assignedCount project${assignedCount != 1 ? 's' : ''}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: assignedCount > 0
                              ? VelanTheme.success
                              : Colors.grey.shade600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: _showEditDialog,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            child: Icon(Icons.edit, size: 18,
                                color: Colors.blue.shade600),
                          ),
                        ),
                        const SizedBox(width: 4),
                        InkWell(
                          onTap: _showDeleteConfirmation,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            child: Icon(Icons.delete_outline, size: 18,
                                color: Colors.red.shade400),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ─── Expandable Projects Section ──────────
          if (assignedCount > 0) ...[
            InkWell(
              onTap: () => setState(() => _isExpanded = !_isExpanded),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  border:
                      Border(top: BorderSide(color: Colors.grey.shade200)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.folder_outlined, size: 16,
                        color: Colors.grey.shade600),
                    const SizedBox(width: 8),
                    Text(
                      'Assigned Projects',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      _isExpanded ? Icons.expand_less : Icons.expand_more,
                      size: 20,
                      color: Colors.grey.shade600,
                    ),
                  ],
                ),
              ),
            ),
            if (_isExpanded)
              Container(
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                ),
                child: Column(
                  children: widget.assignedProjects.map((project) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: project.isComplete
                                  ? VelanTheme.success
                                  : VelanTheme.accentBright,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              project.projectName,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          Text(
                            project.projectCode,
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade500,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: project.isComplete
                                  ? VelanTheme.success.withOpacity(0.1)
                                  : VelanTheme.accentBright.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              project.isComplete ? 'Done' : 'Active',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: project.isComplete
                                    ? VelanTheme.success
                                    : VelanTheme.accentBright,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Manager Card (preserved from original)
// ═══════════════════════════════════════════════════════════════════════════

class _ManagerCard extends ConsumerStatefulWidget {
  final ManagerEntity manager;
  final List<ProjectEntity> allProjects;

  const _ManagerCard({
    required this.manager,
    required this.allProjects,
  });

  @override
  ConsumerState<_ManagerCard> createState() => _ManagerCardState();
}

class _ManagerCardState extends ConsumerState<_ManagerCard> {
  bool _isExpanded = false;

  List<ProjectEntity> get _assignedProjects {
    return widget.allProjects
        .where((p) => p.managerIds.contains(widget.manager.id))
        .toList();
  }

  void _showDeleteConfirmation() async {
    final activeProjects = _assignedProjects.where((p) => !p.isComplete).toList();
    final message = activeProjects.isNotEmpty
        ? 'This manager has ${activeProjects.length} active project(s). These projects will need to be reassigned to another manager.'
        : 'This action cannot be undone.';
    final extraContent = activeProjects.isNotEmpty
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...activeProjects.take(3).map((p) => Padding(
                padding: const EdgeInsets.only(left: 8, bottom: 4),
                child: Text('• ${p.projectName}',
                    style: TextStyle(color: Colors.grey.shade700)),
              )),
              if (activeProjects.length > 3)
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Text('...and ${activeProjects.length - 3} more',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
                ),
            ],
          )
        : null;

    final confirm = await showConfirmBottomSheet(
      context,
      title: 'Remove Manager?',
      message: message,
      confirmLabel: 'Remove',
      confirmColor: Colors.red,
      extraContent: extraContent,
    );
    if (confirm == true && mounted) {
      await ref
          .read(workerManagerControllerProvider.notifier)
          .deleteManager(widget.manager.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Manager removed')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignedCount = _assignedProjects.length;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 1,
      child: Column(
        children: [
          // ─── Manager Info ──────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Avatar
                CircleAvatar(
                  radius: 24,
                  backgroundColor: VelanTheme.primaryDark.withOpacity(0.1),
                  child: Text(
                    widget.manager.name.isNotEmpty
                        ? widget.manager.name[0].toUpperCase()
                        : '?',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 20,
                      color: VelanTheme.primaryDark,
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.manager.name,
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                      ),
                      const SizedBox(height: 4),
                      if (widget.manager.phone.isNotEmpty)
                        Row(
                          children: [
                            Icon(Icons.phone, size: 14,
                                color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Text(
                              widget.manager.phone,
                              style: TextStyle(
                                  color: Colors.grey.shade600, fontSize: 13),
                            ),
                          ],
                        ),
                      if (widget.manager.email.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Row(
                            children: [
                              Icon(Icons.email, size: 14,
                                  color: Colors.grey.shade500),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  widget.manager.email,
                                  style: TextStyle(
                                      color: Colors.grey.shade600,
                                      fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Action buttons
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Project count badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: assignedCount > 0
                            ? VelanTheme.success.withOpacity(0.1)
                            : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '$assignedCount project${assignedCount != 1 ? 's' : ''}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: assignedCount > 0
                              ? VelanTheme.success
                              : Colors.grey.shade600,
                        ),
                      ),
                    ),
                    if (widget.manager.isSuspended) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'Suspended',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.red,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        InkWell(
                          onTap: () {
                            showFormBottomSheet(
                              context: context,
                              title: 'Edit Manager',
                              child: EditManagerDialog(manager: widget.manager),
                            );
                          },
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            child: Icon(Icons.edit, size: 18,
                                color: Colors.blue.shade600),
                          ),
                        ),
                        const SizedBox(width: 4),
                        InkWell(
                          onTap: _showDeleteConfirmation,
                          borderRadius: BorderRadius.circular(8),
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            child: Icon(Icons.delete_outline, size: 18,
                                color: Colors.red.shade400),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ─── Expandable Projects Section ──────────
          if (assignedCount > 0) ...[
            InkWell(
              onTap: () => setState(() => _isExpanded = !_isExpanded),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  border:
                      Border(top: BorderSide(color: Colors.grey.shade200)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.folder_outlined, size: 16,
                        color: Colors.grey.shade600),
                    const SizedBox(width: 8),
                    Text(
                      'Assigned Projects',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade700,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      _isExpanded ? Icons.expand_less : Icons.expand_more,
                      size: 20,
                      color: Colors.grey.shade600,
                    ),
                  ],
                ),
              ),
            ),
            if (_isExpanded)
              Container(
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(16),
                    bottomRight: Radius.circular(16),
                  ),
                ),
                child: Column(
                  children: _assignedProjects.map((project) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: project.isComplete
                                  ? VelanTheme.success
                                  : VelanTheme.accentBright,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              project.projectName,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          Text(
                            project.projectCode,
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade500,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: project.isComplete
                                  ? VelanTheme.success.withOpacity(0.1)
                                  : VelanTheme.accentBright.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              project.isComplete ? 'Done' : 'Active',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: project.isComplete
                                    ? VelanTheme.success
                                    : VelanTheme.accentBright,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
