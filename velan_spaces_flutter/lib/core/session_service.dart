import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

const _roleKey = 'session_role';
const _metaKey = 'session_meta';

class SessionService {
  static const _storage = FlutterSecureStorage();

  /// Save the current session (role + metadata) to secure storage.
  static Future<void> saveSession({
    required UserRole role,
    required Map<String, dynamic> meta,
  }) async {
    await _storage.write(key: _roleKey, value: role.name);
    await _storage.write(key: _metaKey, value: jsonEncode(meta));
  }

  /// Load the persisted session. Returns null if no session exists.
  static Future<({UserRole role, Map<String, dynamic> meta})?> loadSession() async {
    final roleName = await _storage.read(key: _roleKey);
    if (roleName == null) return null;

    final role = userRoleFromString(roleName);
    if (role == UserRole.unknown) return null;

    final metaJson = await _storage.read(key: _metaKey);
    final meta = metaJson != null
        ? Map<String, dynamic>.from(jsonDecode(metaJson) as Map)
        : <String, dynamic>{};

    return (role: role, meta: meta);
  }

  /// Clear the persisted session (on logout).
  static Future<void> clearSession() async {
    await _storage.delete(key: _roleKey);
    await _storage.delete(key: _metaKey);
  }
}
