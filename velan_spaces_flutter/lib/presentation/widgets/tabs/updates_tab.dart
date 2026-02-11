import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
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

    return Column(
      children: [
        // ─── Header / Create Button ─────────────────
        if (canPost)
          Padding(
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
                      CreateUpdateForm(projectId: widget.projectId),
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
        
        if (!canPost && !_showCreateForm) const SizedBox(height: 16),

        // ─── Feed ───────────────────────────────────
        Expanded(
          child: updatesAsync.when(
            data: (updates) {
              if (updates.isEmpty) {
                return Center(
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
                );
              }
              // Sort by newest first
              final sortedUpdates = List.of(updates)..sort((a, b) => b.timestamp.compareTo(a.timestamp));
              
              return ListView.builder(
                padding: const EdgeInsets.only(bottom: 24),
                itemCount: sortedUpdates.length,
                itemBuilder: (context, index) =>
                    UpdateCard(update: sortedUpdates[index], projectId: widget.projectId),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, _) => Center(child: Text('Error: $err')),
          ),
        ),
      ],
    );
  }
}
