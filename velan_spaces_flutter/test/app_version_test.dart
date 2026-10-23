import 'package:flutter_test/flutter_test.dart';
import 'package:velan_spaces_flutter/core/app_version.dart';
import 'package:velan_spaces_flutter/core/deep_links.dart';
import 'package:velan_spaces_flutter/core/navigation/notification_navigation.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

void main() {
  test('compareVersions', () {
    expect(compareVersions('1.0.2', '1.0.3'), lessThan(0));
    expect(compareVersions('1.0.10', '1.0.9'), greaterThan(0));
    expect(compareVersions('1.0', '1.0.0'), 0);
    expect(compareVersions('1.0.2+6', '1.0.2'), 0);
    expect(compareVersions('v2.0.0', '1.9.9'), greaterThan(0));
    expect(compareVersions('abc', '1.0.0'), isNull);
    expect(compareVersions('1.0.0', null), isNull);
  });

  test('isUpdateRequired fails open on bad input', () {
    expect(isUpdateRequired('1.0.2', '1.0.3'), isTrue);
    expect(isUpdateRequired('1.0.3', '1.0.3'), isFalse);
    expect(isUpdateRequired('1.0.2', 'garbage'), isFalse);
    expect(isUpdateRequired('1.0.2', ''), isFalse);
  });

  final token = 'a' * 43;
  test('deep link parsing', () {
    expect(deepLinkRoute(Uri.parse('velanspaces://invite/$token')), '/invite/$token');
    expect(deepLinkRoute(Uri.parse('velanspaces://reset-password/$token')), '/reset-password/$token');
    expect(deepLinkRoute(Uri.parse('velanspaces://invite/short')), isNull);
    expect(deepLinkRoute(Uri.parse('velanspaces://other/$token')), isNull);
    expect(deepLinkRoute(Uri.parse('https://evil.example/invite/$token')), isNull);
    expect(deepLinkRoute(Uri.parse('https://app.test/invite/$token'), webHosts: const ['app.test']),
        '/invite/$token');
  });

  test('notification routes', () {
    expect(notificationRoute(const NotificationTarget(projectId: 'p1'), UserRole.head), '/project/p1');
    expect(notificationRoute(const NotificationTarget(leadId: 'l1'), UserRole.manager), '/manager/sales');
    expect(notificationRoute(const NotificationTarget(leadId: 'l1'), UserRole.head), '/admin/sales');
    expect(notificationRoute(const NotificationTarget(leadId: 'l1'), UserRole.worker), isNull);
    expect(notificationRoute(const NotificationTarget(), UserRole.head), isNull);
    expect(notificationRoute(const NotificationTarget(projectId: 'p1'), UserRole.unknown), isNull);
  });
}
