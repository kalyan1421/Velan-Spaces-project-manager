import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/updates/create_update_form.dart';
import 'package:velan_spaces_flutter/presentation/widgets/updates/update_card.dart';

class UpdatesTab extends ConsumerStatefulWidget {
  const UpdatesTab({required this.projectId, super.key});
  final String projectId;

  @override
  ConsumerState<UpdatesTab> createState() => _UpdatesTabState();
}

class _UpdatesTabState extends ConsumerState<UpdatesTab> {
  bool _showCreateForm = false;

  @override
  Widget build(BuildContext context) {
    final updatesAsync = ref.watch(projectUpdatesProvider(widget.projectId));
    final role = ref.watch(currentUserRoleProvider);
    final canPost = role == UserRole.head || role == UserRole.manager || role == UserRole.worker;

    return CustomScrollView(
      slivers: [
        // ─── Header / Create Button ─────────────────
        if (canPost)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: _showCreateForm
                  ? Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('New Update', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () => setState(() => _showCreateForm = false),
                            ),
                          ],
                        ),
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            maxHeight: MediaQuery.of(context).size.height * 0.6,
                          ),
                          child: CreateUpdateForm(projectId: widget.projectId),
                        ),
                      ],
                    )
                  : SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => setState(() => _showCreateForm = true),
                        icon: const Icon(Icons.add),
                        label: const Text('Post New Update'),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
            ),
          ),
        
        if (!canPost && !_showCreateForm) 
          const SliverToBoxAdapter(child: SizedBox(height: 16)),

        // ─── Feed ───────────────────────────────────
        updatesAsync.when(
          data: (updates) {
            if (updates.isEmpty) {
              return SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.update, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(
                        'No updates yet',
                        style: TextStyle(color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              );
            }
            // Sort by newest first
            final sortedUpdates = List.of(updates)..sort((a, b) => b.timestamp.compareTo(a.timestamp));
            
            return SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => UpdateCard(update: sortedUpdates[index], projectId: widget.projectId),
                childCount: sortedUpdates.length,
              ),
            );
          },
          loading: () => const SliverFillRemaining(child: Center(child: CircularProgressIndicator())),
          error: (err, _) => SliverFillRemaining(child: Center(child: Text('Error: $err'))),
        ),
        
        const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
      ],
    );
  }
}
