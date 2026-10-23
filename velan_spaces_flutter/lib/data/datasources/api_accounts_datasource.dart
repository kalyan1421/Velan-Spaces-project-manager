import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

/// Result of inviting a client: a link to share, or — when the email already
/// has a client account — nothing to share (they were added to the project).
class ClientInviteResult {
  const ClientInviteResult({required this.alreadyRegistered, this.inviteUrl});

  final bool alreadyRegistered;
  final String? inviteUrl;
}

/// One row of GET /projects/:id/client-invites (tolerates snake/camel case).
class ClientInvite {
  const ClientInvite({
    required this.id,
    required this.email,
    required this.name,
    required this.status,
    this.expiresAt,
    this.usedAt,
    this.createdAt,
    this.inviteUrl,
  });

  final String id;
  final String email;
  final String name;

  /// 'valid' (pending), 'used' (accepted) or 'expired'.
  final String status;
  final DateTime? expiresAt;
  final DateTime? usedAt;
  final DateTime? createdAt;

  /// Only present if the server ever returns it (tokens are hashed today).
  final String? inviteUrl;

  bool get isPending => status == 'valid' || status == 'pending';

  factory ClientInvite.fromJson(Map<String, dynamic> j) {
    String? str(List<String> keys) {
      for (final k in keys) {
        final v = j[k];
        if (v is String && v.isNotEmpty) return v;
      }
      return null;
    }

    final expires = DateTime.tryParse(str(['expires_at', 'expiresAt']) ?? '');
    final used = DateTime.tryParse(str(['used_at', 'usedAt']) ?? '');
    var status = str(['status']);
    status ??= used != null
        ? 'used'
        : (expires != null && expires.isBefore(DateTime.now()) ? 'expired' : 'valid');
    return ClientInvite(
      id: str(['id']) ?? '',
      email: str(['email']) ?? '',
      name: str(['display_name', 'displayName', 'name']) ?? '',
      status: status,
      expiresAt: expires,
      usedAt: used,
      createdAt: DateTime.tryParse(str(['created_at', 'createdAt']) ?? ''),
      inviteUrl: str(['inviteUrl', 'invite_url', 'url', 'link']),
    );
  }
}

/// Public details of an invite / reset link (what the link is for).
class AccountLinkInfo {
  const AccountLinkInfo({this.email, this.displayName, this.projectName, this.expiresAt});
  final String? email;
  final String? displayName;
  final String? projectName;
  final String? expiresAt;

  factory AccountLinkInfo.fromJson(dynamic j) {
    final m = j is Map ? j : const {};
    String? s(String k) => m[k] is String && (m[k] as String).isNotEmpty ? m[k] as String : null;
    return AccountLinkInfo(
      email: s('email') ?? s('login'),
      displayName: s('displayName'),
      projectName: s('projectName'),
      expiresAt: s('expiresAt'),
    );
  }
}

/// Client invitations (accounts are created when the client opens the link
/// and sets a password on the web).
class ApiAccountsDatasource {
  ApiAccountsDatasource(this._api);

  final ApiClient _api;

  Future<ClientInviteResult> inviteClient(
    String projectId, {
    required String email,
    required String displayName,
    String phone = '',
  }) async {
    final res = await _api.post('/projects/$projectId/client-invites', {
      'email': email.trim().toLowerCase(),
      'displayName': displayName.trim(),
      if (phone.trim().isNotEmpty) 'phone': phone.trim(),
    }) as Map<String, dynamic>;
    ApiInvalidation.instance.notifyAll([ApiTopics.project(projectId), ApiTopics.projects]);
    return ClientInviteResult(
      alreadyRegistered: res['alreadyRegistered'] == true,
      inviteUrl: res['inviteUrl'] as String?,
    );
  }

  Future<List<ClientInvite>> listClientInvites(String projectId) async {
    final res = await _api.get('/projects/$projectId/client-invites');
    if (res is! List) return const [];
    return res
        .whereType<Map>()
        .map((m) => ClientInvite.fromJson(Map<String, dynamic>.from(m)))
        .where((i) => i.id.isNotEmpty)
        .toList();
  }

  /// Revokes a pending invite (404 unknown, 409 already accepted/expired).
  Future<void> revokeClientInvite(String projectId, String inviteId) async {
    await _api.delete('/projects/$projectId/client-invites/$inviteId');
    ApiInvalidation.instance.notify(ApiTopics.project(projectId));
  }

  // ── Public link endpoints (no session) ────────────────────────────
  Future<AccountLinkInfo> describeInvite(String token) async =>
      AccountLinkInfo.fromJson(await _api.getPublic('/auth/invites/$token'));

  Future<void> acceptInvite(String token, {required String password, String? displayName}) async {
    await _api.postPublic('/auth/invites/$token/accept', {
      'password': password,
      if (displayName != null && displayName.trim().isNotEmpty) 'displayName': displayName.trim(),
    });
  }

  Future<AccountLinkInfo> describeReset(String token) async =>
      AccountLinkInfo.fromJson(await _api.getPublic('/auth/password-reset/$token'));

  Future<void> resetPassword(String token, String newPassword) async {
    await _api.postPublic('/auth/password-reset/$token', {'newPassword': newPassword});
  }
}

final accountsDatasourceProvider = Provider<ApiAccountsDatasource>((ref) {
  return ApiAccountsDatasource(ref.watch(apiClientProvider));
});
