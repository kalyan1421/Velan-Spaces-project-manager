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
}

final accountsDatasourceProvider = Provider<ApiAccountsDatasource>((ref) {
  return ApiAccountsDatasource(ref.watch(apiClientProvider));
});
