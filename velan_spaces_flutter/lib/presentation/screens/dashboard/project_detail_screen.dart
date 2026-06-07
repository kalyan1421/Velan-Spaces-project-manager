import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/notification_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/worker_manager_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/updates_tab.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/designs_tab.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/timeline_tab.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/workers_tab.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/rooms_tab.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/settlements_tab.dart';
import 'package:velan_spaces_flutter/presentation/widgets/tabs/budget_tab.dart';
import 'package:velan_spaces_flutter/presentation/providers/design_prefetch_provider.dart';

class ProjectDetailScreen extends ConsumerStatefulWidget {
  const ProjectDetailScreen({required this.projectId, super.key});

  final String projectId;

  @override
  ConsumerState<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends ConsumerState<ProjectDetailScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  bool _showProgressOverview = true;

  List<_TabInfo> _getTabsForRole(UserRole role) {
    switch (role) {
      case UserRole.client:
        return [
          _TabInfo(Icons.feed, 'Updates'),
          _TabInfo(Icons.design_services, 'Designs'),
          _TabInfo(Icons.timeline, 'Timeline'),
        ];
      case UserRole.worker:
        return [
          _TabInfo(Icons.feed, 'Updates'),
          _TabInfo(Icons.design_services, 'Designs'),
          _TabInfo(Icons.timeline, 'Timeline'),
        ];
      default: // HEAD and MANAGER get all tabs
        return [
          _TabInfo(Icons.feed, 'Updates'),
          _TabInfo(Icons.design_services, 'Designs'),
          _TabInfo(Icons.timeline, 'Timeline'),
          _TabInfo(Icons.people, 'Workers'),
          _TabInfo(Icons.room_preferences, 'Rooms'),
          _TabInfo(Icons.receipt_long, 'Settle'),
          _TabInfo(Icons.account_balance_wallet, 'Budget'),
        ];
    }
  }

  List<Widget> _getTabViewsForRole(UserRole role, String projectId) {
    switch (role) {
      case UserRole.client:
        return [
          UpdatesTab(projectId: projectId),
          DesignsTab(projectId: projectId),
          TimelineTab(projectId: projectId),
        ];
      case UserRole.worker:
        return [
          UpdatesTab(projectId: projectId),
          DesignsTab(projectId: projectId),
          TimelineTab(projectId: projectId),
        ];
      default:
        return [
          UpdatesTab(projectId: projectId),
          DesignsTab(projectId: projectId),
          TimelineTab(projectId: projectId),
          WorkersTab(projectId: projectId),
          RoomsTab(projectId: projectId),
          SettlementsTab(projectId: projectId),
          BudgetTab(projectId: projectId),
        ];
    }
  }

  @override
  void initState() {
    super.initState();
    // Will be initialized in build based on role
    _tabController = TabController(length: 7, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final projectAsync = ref.watch(projectDetailProvider(widget.projectId));
    final role = ref.watch(currentUserRoleProvider);
    final tabs = _getTabsForRole(role);

    // Rebuild tab controller if length changes
    if (_tabController.length != tabs.length) {
      _tabController.dispose();
      _tabController = TabController(length: tabs.length, vsync: this);
    }
    
    // Start prefetching designs
    ref.watch(designPrefetchProvider(widget.projectId));

    return projectAsync.when(
      data: (project) {
        return Scaffold(
          body: NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) {
              return [
                SliverAppBar(
                  floating: true,
                  snap: true,
                  forceElevated: innerBoxIsScrolled,
                  title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('[${project.projectCode}] ${project.projectName}',
                              style: const TextStyle(fontSize: 16)),
                          const SizedBox(width: 8),
                          _buildStatusBadge(project),
                        ],
                      ),
                      Text(
                        '${project.clientName} • ${project.location}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11),
                      ),
                    ],
                  ),
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.support_agent_outlined),
                      tooltip: 'Support',
                      onPressed: () => context.push('/project/${project.id}/support'),
                    ),
                    IconButton(
                      icon: Icon(
                        _showProgressOverview
                            ? Icons.expand_less
                            : Icons.expand_more,
                        size: 20,
                      ),
                      tooltip: _showProgressOverview ? 'Hide overview' : 'Show overview',
                      onPressed: () {
                        setState(() => _showProgressOverview = !_showProgressOverview);
                      },
                    ),
                    if (role == UserRole.head || role == UserRole.manager)
                      PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert),
                        tooltip: 'Project actions',
                        onSelected: (value) {
                          if (value == 'edit') {
                            context.push('/project/${project.id}/edit');
                          } else if (value == 'assign') {
                            _showAssignManagerSheet(context, project);
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(
                            value: 'edit',
                            child: Row(
                              children: [
                                Icon(Icons.edit_outlined, size: 18),
                                SizedBox(width: 10),
                                Text('Edit Project'),
                              ],
                            ),
                          ),
                          if (role == UserRole.head)
                            const PopupMenuItem(
                              value: 'assign',
                              child: Row(
                                children: [
                                  Icon(Icons.person_add_outlined, size: 18),
                                  SizedBox(width: 10),
                                  Text('Assign Manager'),
                                ],
                              ),
                            ),
                        ],
                      ),
                  ],

                ),
                if (_showProgressOverview)
                  SliverToBoxAdapter(
                    child: _buildProgressOverview(context, project),
                  ),
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _SliverTabBarDelegate(
                    TabBar(
                      controller: _tabController,
                      isScrollable: tabs.length > 4,
                      tabs: tabs.map((t) => Tab(icon: Icon(t.icon, size: 18), text: t.label)).toList(),
                    ),
                  ),
                ),
              ];
            },
            body: TabBarView(
              controller: _tabController,
              children: _getTabViewsForRole(role, widget.projectId),
            ),
          ),
        );
      },
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('Loading...')),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (err, stack) => Scaffold(
        appBar: AppBar(title: const Text('Error')),
        body: Center(child: Text('Error: $err')),
      ),
    );
  }

  // ── Assign Manager quick-sheet (admin only) ──────────────────────────────
  void _showAssignManagerSheet(BuildContext context, ProjectEntity project) {
    final managersAsync = ref.read(allManagersProvider);
    final allManagers = managersAsync.valueOrNull ?? [];
    final selected = Set<String>.from(project.managerIds);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.6,
              maxChildSize: 0.9,
              builder: (_, scrollCtrl) {
                return Column(
                  children: [
                    Center(
                      child: Container(
                        margin: const EdgeInsets.only(top: 12, bottom: 8),
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        children: [
                          const Text(
                            'Assign Manager',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () async {
                              Navigator.pop(ctx);
                              final notifier = ref.read(projectUpdateNotifierProvider.notifier);
                              await notifier.updateProject(
                                project.id,
                                {'managerIds': selected.toList()},
                              );
                              final service = ref.read(notificationServiceProvider);
                              final newManagers = selected.difference(
                                Set<String>.from(project.managerIds),
                              );
                              for (final mid in newManagers) {
                                await service.notifyManagerOfAssignment(
                                  managerId: mid,
                                  projectId: project.id,
                                  projectName: project.projectName,
                                );
                              }
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Managers updated'),
                                    backgroundColor: Color(0xFF22C55E),
                                  ),
                                );
                              }
                            },
                            child: const Text(
                              'Save',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFFFB347),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    Expanded(
                      child: allManagers.isEmpty
                          ? const Center(child: Text('No managers found'))
                          : ListView.builder(
                              controller: scrollCtrl,
                              itemCount: allManagers.length,
                              itemBuilder: (_, i) {
                                final m = allManagers[i];
                                final isChecked = selected.contains(m.id);
                                return CheckboxListTile(
                                  value: isChecked,
                                  title: Text(m.name),
                                  subtitle: Text(m.phone),
                                  secondary: CircleAvatar(
                                    backgroundColor: const Color(0xFFFFB347),
                                    child: Text(
                                      m.name.isNotEmpty ? m.name[0].toUpperCase() : '?',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  activeColor: const Color(0xFFFFB347),
                                  onChanged: (val) {
                                    setSheetState(() {
                                      if (val == true) {
                                        selected.add(m.id);
                                      } else {
                                        selected.remove(m.id);
                                      }
                                    });
                                  },
                                );
                              },
                            ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        '${selected.length} manager(s) selected',
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildStatusBadge(ProjectEntity project) {
    final isComplete = project.isComplete;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isComplete ? const Color(0xFFDCFCE7) : const Color(0xFFFFF7E6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        isComplete ? 'Completed' : 'Active',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: isComplete ? const Color(0xFF16A34A) : const Color(0xFFD97706),
        ),
      ),
    );
  }

  Widget _buildProgressOverview(BuildContext context, ProjectEntity project) {
    final spendRatio = project.budget > 0
        ? (project.currentSpend / project.budget).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // ─── Circular Progress ─────────────────────────
          SizedBox(
            width: 64,
            height: 64,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: project.completionPercentage / 100,
                  strokeWidth: 6,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(
                    project.isComplete
                        ? const Color(0xFF22C55E)
                        : const Color(0xFFFFB347),
                  ),
                ),
                Text(
                  '${project.completionPercentage}%',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 20),
          // ─── Stats ─────────────────────────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Workers count
                Row(
                  children: [
                    Icon(Icons.people_outline, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 6),
                    Text(
                      '${project.workerIds.length} workers assigned',
                      style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                    ),
                  ],
                ),
                if (project.targetEndDate != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey[600]),
                      const SizedBox(width: 6),
                      Text(
                        'Due: ${FormatUtils.formatDate(project.targetEndDate!)}',
                        style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                // Budget bar
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Budget: ${FormatUtils.formatCurrency(project.currentSpend)} / ${FormatUtils.formatCurrency(project.budget)}',
                          style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: spendRatio,
                        minHeight: 5,
                        backgroundColor: Colors.grey[200],
                        valueColor: AlwaysStoppedAnimation<Color>(
                          spendRatio > 0.9
                              ? Colors.red
                              : spendRatio > 0.7
                                  ? Colors.orange
                                  : const Color(0xFF22C55E),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TabInfo {
  final IconData icon;
  final String label;
  _TabInfo(this.icon, this.label);
}

class _SliverTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar _tabBar;

  _SliverTabBarDelegate(this._tabBar);

  @override
  double get minExtent => _tabBar.preferredSize.height;
  @override
  double get maxExtent => _tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: _tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverTabBarDelegate oldDelegate) {
    return false;
  }
}
