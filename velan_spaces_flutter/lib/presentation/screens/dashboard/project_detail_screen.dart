import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
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
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(project.projectName, style: const TextStyle(fontSize: 16)),
                Text(
                  '${project.clientName} • ${project.location}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11),
                ),
              ],
            ),
            bottom: TabBar(
              controller: _tabController,
              isScrollable: tabs.length > 4,
              tabs: tabs.map((t) => Tab(icon: Icon(t.icon, size: 18), text: t.label)).toList(),
            ),
          ),
          body: TabBarView(
            controller: _tabController,
            children: _getTabViewsForRole(role, widget.projectId),
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
}

class _TabInfo {
  final IconData icon;
  final String label;
  _TabInfo(this.icon, this.label);
}
