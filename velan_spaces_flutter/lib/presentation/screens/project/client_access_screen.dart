import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:velan_spaces_flutter/data/datasources/api_accounts_datasource.dart';

final clientInvitesProvider =
    FutureProvider.autoDispose.family<List<ClientInvite>, String>((ref, projectId) {
  return ref.watch(accountsDatasourceProvider).listClientInvites(projectId);
});

/// Invites sent for a project: status, expiry, copy-link and revoke.
/// Reached from the project menu (head and managers only).
class ClientAccessScreen extends ConsumerWidget {
  const ClientAccessScreen({required this.projectId, super.key});

  final String projectId;

  static final _fmt = DateFormat('d MMM yyyy, h:mm a');

  Future<void> _revoke(BuildContext context, WidgetRef ref, ClientInvite invite) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke invite?'),
        content: Text('${invite.email.isEmpty ? 'This invite' : invite.email} will no longer be able to join with this link.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(accountsDatasourceProvider).revokeClientInvite(projectId, invite.id);
      messenger.showSnackBar(const SnackBar(content: Text('Invite revoked')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    }
    ref.invalidate(clientInvitesProvider(projectId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invites = ref.watch(clientInvitesProvider(projectId));
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(title: const Text('Client access')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(clientInvitesProvider(projectId));
          try {
            await ref.read(clientInvitesProvider(projectId).future);
          } catch (_) {}
        },
        child: invites.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [
            Padding(padding: const EdgeInsets.all(32), child: Center(child: Text('Could not load invites: $e'))),
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: Text('No client invites for this project yet.')),
                ),
              ]);
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _tile(context, ref, list[i]),
            );
          },
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, WidgetRef ref, ClientInvite inv) {
    final (label, color) = switch (inv.status) {
      'valid' || 'pending' => ('Pending', const Color(0xFFF59E0B)),
      'used' => ('Accepted', const Color(0xFF22C55E)),
      'expired' => ('Expired', const Color(0xFF9CA3AF)),
      final other => (other.isEmpty ? 'Unknown' : other, const Color(0xFF9CA3AF)),
    };
    final expiry = inv.expiresAt == null
        ? null
        : '${inv.isPending ? 'Expires' : 'Expired'} ${_fmt.format(inv.expiresAt!.toLocal())}';
    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(inv.name.isEmpty ? (inv.email.isEmpty ? 'Client' : inv.email) : inv.name,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
              ),
            ]),
            if (inv.email.isNotEmpty && inv.name.isNotEmpty)
              Text(inv.email, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            if (expiry != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(expiry, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
              ),
            if (inv.isPending || inv.inviteUrl != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(children: [
                  if (inv.inviteUrl != null)
                    TextButton.icon(
                      onPressed: () async {
                        final m = ScaffoldMessenger.of(context);
                        await Clipboard.setData(ClipboardData(text: inv.inviteUrl!));
                        m.showSnackBar(const SnackBar(content: Text('Link copied')));
                      },
                      icon: const Icon(Icons.copy, size: 16),
                      label: const Text('Copy link'),
                    ),
                  const Spacer(),
                  if (inv.isPending)
                    TextButton.icon(
                      onPressed: () => _revoke(context, ref, inv),
                      style: TextButton.styleFrom(foregroundColor: Colors.red),
                      icon: const Icon(Icons.block, size: 16),
                      label: const Text('Revoke'),
                    ),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}
