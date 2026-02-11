import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/auth/login_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/head_dashboard_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/manager_dashboard_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/worker_dashboard_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/client_dashboard_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/dashboard/project_detail_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/project/create_project_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Create a notifier that GoRouter can listen to for auth changes
  final authNotifier = ValueNotifier<UserRole>(UserRole.unknown);
  
  // Update the notifier when the provider state changes
  ref.listen<UserRole>(
    currentUserRoleProvider,
    (_, next) => authNotifier.value = next,
  );

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final role = ref.read(currentUserRoleProvider);
      final isLoginRoute = state.matchedLocation == '/login';

      // If not logged in (unknown role), force login
      if (role == UserRole.unknown) {
        return isLoginRoute ? null : '/login';
      }

      // If logged in and on login page, redirect to role-specific dashboard
      if (isLoginRoute) {
        return _dashboardPathForRole(role);
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dashboard/head',
        builder: (context, state) => const HeadDashboardScreen(),
      ),
      GoRoute(
        path: '/dashboard/manager',
        builder: (context, state) => const ManagerDashboardScreen(),
      ),
      GoRoute(
        path: '/dashboard/worker',
        builder: (context, state) => const WorkerDashboardScreen(),
      ),
      GoRoute(
        path: '/dashboard/client',
        builder: (context, state) => const ClientDashboardScreen(),
      ),
      GoRoute(
        path: '/create-project',
        builder: (context, state) => const CreateProjectScreen(),
      ),
      GoRoute(
        path: '/project/:projectId',
        builder: (context, state) {
          final projectId = state.pathParameters['projectId']!;
          return ProjectDetailScreen(projectId: projectId);
        },
      ),
    ],
  );
});

String _dashboardPathForRole(UserRole role) {
  switch (role) {
    case UserRole.head:
      return '/dashboard/head';
    case UserRole.manager:
      return '/dashboard/manager';
    case UserRole.worker:
      return '/dashboard/worker';
    case UserRole.client:
      return '/dashboard/client';
    default:
      return '/login';
  }
}
