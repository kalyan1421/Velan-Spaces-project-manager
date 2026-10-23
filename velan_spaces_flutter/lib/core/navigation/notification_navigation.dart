import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

/// Where a notification (in-app row or push) points. Every id may be empty.
@immutable
class NotificationTarget {
  const NotificationTarget({this.projectId = '', this.leadId = '', this.entityId = '', this.type = ''});

  final String projectId;
  final String leadId;
  final String entityId;
  final String type;

  /// From FCM `data` (string -> string) or a decoded payload map.
  factory NotificationTarget.fromMap(Map<dynamic, dynamic>? m) {
    String s(String k) => m?[k] is String ? m![k] as String : '';
    return NotificationTarget(
      projectId: s('projectId'),
      leadId: s('leadId'),
      entityId: s('entityId'),
      type: s('type'),
    );
  }

  /// Local-notification payload: JSON, or a legacy bare projectId string.
  factory NotificationTarget.fromPayload(String? payload) {
    if (payload == null || payload.isEmpty) return const NotificationTarget();
    try {
      final d = jsonDecode(payload);
      if (d is Map) return NotificationTarget.fromMap(d);
    } catch (_) {}
    return NotificationTarget(projectId: payload);
  }

  String toPayload() => jsonEncode({
        'projectId': projectId,
        'leadId': leadId,
        'entityId': entityId,
        'type': type,
      });
}

/// The route for a notification, or null when there is nowhere to go.
/// Projects open project detail (designs/updates live in its tabs); leads open
/// the Sales list of the role that has one (head/manager).
String? notificationRoute(NotificationTarget t, UserRole role) {
  if (role == UserRole.unknown) return null;
  if (t.projectId.isNotEmpty) return '/project/${t.projectId}';
  if (t.leadId.isNotEmpty) {
    if (role == UserRole.head) return '/admin/sales';
    if (role == UserRole.manager) return '/manager/sales';
  }
  return null;
}

/// Bridges code without a BuildContext (FCM taps) to the app router.
class AppNavigation {
  AppNavigation._();

  static GoRouter? _router;
  static UserRole Function()? _role;

  static void bind(GoRouter router, UserRole Function() role) {
    _router = router;
    _role = role;
  }

  /// Safe to call at any time; silently ignores unroutable targets.
  static bool open(NotificationTarget t, {GoRouter? router, UserRole? role}) {
    final r = router ?? _router;
    final route = notificationRoute(t, role ?? _role?.call() ?? UserRole.unknown);
    if (r == null || route == null) return false;
    try {
      if (route.startsWith('/project/')) {
        r.push(route);
      } else {
        r.go(route);
      }
      return true;
    } catch (e) {
      if (kDebugMode) debugPrint('Notification navigation failed: $e');
      return false;
    }
  }
}
