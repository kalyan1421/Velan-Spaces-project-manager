import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/head_dashboard_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/manager_dashboard_screen.dart';

/// This screen acts as a dispatcher, showing the correct dashboard
/// based on the authenticated user's role.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // authStateChangesProvider provides the user with the role
    final userAsyncValue = ref.watch(authStateChangesProvider);

    return userAsyncValue.when(
      data: (user) {
        if (user == null) {
          // This should not happen due to router redirect, but as a fallback:
          return const Scaffold(body: Center(child: Text('Not authenticated.')));
        }

        // Add a common scaffold here to provide a consistent AppBar with a logout button
        return Scaffold(
          appBar: AppBar(
            title: Text(_getTitleForRole(user.role)),
            actions: [
              IconButton(
                icon: const Icon(Icons.logout),
                onPressed: () {
                  ref.read(authNotifierProvider.notifier).signOut();
                },
              )
            ],
          ),
          body: _buildDashboardForRole(user.role),
        );
      },
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (err, stack) => Scaffold(body: Center(child: Text('Error: $err'))),
    );
  }

  String _getTitleForRole(String? role) {
    switch (role) {
      case 'HEAD':
        return 'Admin Dashboard';
      case 'MANAGER':
        return 'Manager Dashboard';
      case 'WORKER':
        return 'Worker Portal';
      case 'CLIENT':
        return 'Project View';
      default:
        return 'Dashboard';
    }
  }

  Widget _buildDashboardForRole(String? role) {
    switch (role) {
      case 'HEAD':
        return const HeadDashboardScreen();
      case 'MANAGER':
        return const ManagerDashboardScreen();
      case 'WORKER':
        // TODO: Create and return WorkerDashboardScreen
        return const Center(child: Text('Worker Dashboard UI'));
      case 'CLIENT':
        // TODO: Create and return ClientDashboardScreen
        return const Center(child: Text('Client Dashboard UI'));
      default:
        return const Center(child: Text('Unknown role. Please contact support.'));
    }
  }
}
