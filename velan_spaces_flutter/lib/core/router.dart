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
import 'package:velan_spaces_flutter/presentation/screens/profile_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/staff_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/sales_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/website_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/notifications_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/project/create_project_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/project/edit_project_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/project/project_support_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quotation_settings_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/catalog_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quote_list_screen.dart';
import 'package:velan_spaces_flutter/presentation/widgets/shells/admin_shell.dart';
import 'package:velan_spaces_flutter/presentation/widgets/shells/manager_shell.dart';

// Root navigator key — routes with this key push above all shells (hides bottom nav)
final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final routerProvider = Provider<GoRouter>((ref) {
  final authNotifier = ValueNotifier<UserRole>(UserRole.unknown);

  ref.listen<UserRole>(
    currentUserRoleProvider,
    (_, next) => authNotifier.value = next,
  );

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/login',
    refreshListenable: authNotifier,
    redirect: (context, state) {
      final role = ref.read(currentUserRoleProvider);
      final isLoginRoute = state.matchedLocation == '/login';

      if (role == UserRole.unknown) {
        return isLoginRoute ? null : '/login';
      }
      if (isLoginRoute) {
        return _initialRouteForRole(role);
      }
      return null;
    },
    routes: [
      // ── Auth ────────────────────────────────────────────────────────
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),

      // ── Project Detail — root-level so it pushes ABOVE shells ───────
      // (bottom nav is hidden when viewing project detail)
      GoRoute(
        path: '/project/:projectId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => ProjectDetailScreen(
          projectId: state.pathParameters['projectId']!,
        ),
      ),

      // ── Create Project — also above shell ───────────────────────────
      GoRoute(
        path: '/create-project',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const CreateProjectScreen(),
      ),

      // ── Edit Project — also above shell ─────────────────────────────
      GoRoute(
        path: '/project/:projectId/edit',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => EditProjectScreen(
          projectId: state.pathParameters['projectId']!,
        ),
      ),

      GoRoute(
        path: '/project/:projectId/support',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => ProjectSupportScreen(
          projectId: state.pathParameters['projectId']!,
        ),
      ),

      // ── Notifications ────────────────────────────────────────────────
      GoRoute(
        path: '/notifications',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const NotificationsScreen(),
      ),

      // ── Quotation (admin settings + rate card, per-lead quotes) ──────
      GoRoute(
        path: '/quotation-settings',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const QuotationSettingsScreen(),
      ),
      GoRoute(
        path: '/catalog',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const CatalogScreen(),
      ),
      GoRoute(
        path: '/lead/:leadId/quotes',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => QuoteListScreen(
          leadId: state.pathParameters['leadId']!,
          leadName: state.uri.queryParameters['name'] ?? '',
        ),
      ),

      // ── Admin Shell (head role) — 5 tabs ────────────────────────────
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AdminShell(navigationShell: navigationShell),
        branches: [
          // Tab 0: Projects
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/projects',
                builder: (context, state) => const HeadDashboardScreen(),
              ),
            ],
          ),
          // Tab 1: Staff
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/staff',
                builder: (context, state) => const StaffScreen(),
              ),
            ],
          ),
          // Tab 2: Sales
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/sales',
                builder: (context, state) => const SalesScreen(),
              ),
            ],
          ),
          // Tab 3: Website
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/website',
                builder: (context, state) => const WebsiteScreen(),
              ),
            ],
          ),
          // Tab 4: Profile
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // ── Manager Shell — 3 tabs ───────────────────────────────────────
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            ManagerShell(navigationShell: navigationShell),
        branches: [
          // Tab 0: Projects
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/manager/projects',
                builder: (context, state) => const ManagerDashboardScreen(),
              ),
            ],
          ),
          // Tab 1: Sales
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/manager/sales',
                builder: (context, state) => const SalesScreen(),
              ),
            ],
          ),
          // Tab 2: Profile
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/manager/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // ── Worker — no shell / bottom nav ──────────────────────────────
      GoRoute(
        path: '/worker/projects',
        builder: (context, state) => const WorkerDashboardScreen(),
      ),

      // ── Client — no shell / bottom nav ──────────────────────────────
      GoRoute(
        path: '/client/project',
        builder: (context, state) => const ClientDashboardScreen(),
      ),
    ],
  );
});

String _initialRouteForRole(UserRole role) {
  switch (role) {
    case UserRole.head:
      return '/admin/projects';
    case UserRole.manager:
      return '/manager/projects';
    case UserRole.worker:
      return '/worker/projects';
    case UserRole.client:
      return '/client/project';
    default:
      return '/login';
  }
}
