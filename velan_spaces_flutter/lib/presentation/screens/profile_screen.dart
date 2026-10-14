import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

const _supportEmail = 'support@velanspaces.com';

Future<void> _launchSupportMail(BuildContext context, {String subject = ''}) async {
  final uri = Uri(
    scheme: 'mailto',
    path: _supportEmail,
    query: subject.isEmpty ? null : 'subject=${Uri.encodeComponent(subject)}',
  );
  var opened = false;
  try {
    opened = await launchUrl(uri);
  } catch (_) {
    opened = false;
  }
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No email app found. Write to $_supportEmail')),
    );
  }
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meta = ref.watch(currentUserMetaProvider);
    final role = ref.watch(currentUserRoleProvider);
    final name = meta['name'] as String? ?? _roleLabel(role);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Profile'),
      ),
      body: ListView(
        children: [
          // ── Avatar + name header ──────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: VelanTheme.highlight.withOpacity(0.15),
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: VelanTheme.highlight,
                    ),
                  ),
                ),
                const SizedBox(width: 20),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: VelanTheme.highlight.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _roleLabel(role).toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: VelanTheme.highlight,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // ── Quotation tools (admin + manager) ─────────────────────
          if (role == UserRole.head || role == UserRole.manager) ...[
            Container(
              color: Colors.white,
              child: Column(
                children: [
                  // Rate card + templates — managed by admin AND manager
                  _ProfileTile(
                    icon: Icons.request_quote_outlined,
                    label: 'Rate Card',
                    onTap: () => context.push('/catalog'),
                  ),
                  _ProfileTile(
                    icon: Icons.dashboard_customize_outlined,
                    label: 'Quote Templates',
                    onTap: () => context.push('/quote-templates'),
                  ),
                  // Company branding / defaults — admin only
                  if (role == UserRole.head)
                    _ProfileTile(
                      icon: Icons.tune,
                      label: 'Quotation Settings',
                      onTap: () => context.push('/quotation-settings'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],

          // ── Settings list ─────────────────────────────────────────
          Container(
            color: Colors.white,
            child: Column(
              children: [
                _ProfileTile(
                  icon: Icons.notifications_outlined,
                  label: 'Notifications',
                  onTap: () => context.push('/notifications'),
                ),
                _ProfileTile(
                  icon: Icons.help_outline,
                  label: 'Help & Support',
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                      ),
                      builder: (ctx) => SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Help & Support',
                                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 16),
                              ListTile(
                                leading: const Icon(Icons.email_outlined),
                                title: const Text('Email Us'),
                                subtitle: const Text(_supportEmail),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _launchSupportMail(context);
                                },
                              ),
                              ListTile(
                                leading: const Icon(Icons.bug_report_outlined),
                                title: const Text('Report a Bug'),
                                subtitle: const Text('Help us improve the app'),
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _launchSupportMail(context, subject: 'Velan Spaces app bug report');
                                },
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
                _ProfileTile(
                  icon: Icons.info_outline,
                  label: 'About Velan Spaces',
                  onTap: () {
                    showAboutDialog(
                      context: context,
                      applicationName: 'Velan Spaces',
                      applicationVersion: '1.0.2',
                      applicationLegalese: '© 2026 Velan Spaces. All rights reserved.',
                      children: [
                        const SizedBox(height: 16),
                        const Text(
                          'Velan Spaces Project Manager helps you track construction projects, '
                          'manage workers, handle budgets, and keep clients updated in real-time.',
                        ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // ── Logout ────────────────────────────────────────────────
          Container(
            color: Colors.white,
            child: _ProfileTile(
              icon: Icons.logout,
              label: 'Sign Out',
              labelColor: Colors.red,
              iconColor: Colors.red,
              showChevron: false,
              onTap: () => _confirmLogout(context, ref),
            ),
          ),

          const SizedBox(height: 48),
        ],
      ),
    );
  }

  String _roleLabel(UserRole role) {
    switch (role) {
      case UserRole.head:
        return 'Admin';
      case UserRole.manager:
        return 'Manager';
      case UserRole.worker:
        return 'Worker';
      case UserRole.client:
        return 'Client';
      default:
        return 'User';
    }
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authNotifierProvider.notifier).signOut();
              if (context.mounted) {
                context.go('/login');
              }
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.labelColor,
    this.iconColor,
    this.showChevron = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? labelColor;
  final Color? iconColor;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? Colors.black54, size: 22),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: labelColor ?? Colors.black87,
        ),
      ),
      trailing: showChevron
          ? const Icon(Icons.chevron_right, color: Colors.black26)
          : null,
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
    );
  }
}
