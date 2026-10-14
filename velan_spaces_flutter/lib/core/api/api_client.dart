import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:velan_spaces_flutter/core/api/api_config.dart';
import 'package:velan_spaces_flutter/core/api/api_exception.dart';
import 'package:velan_spaces_flutter/core/api/token_store.dart';

/// JSON client for the Velan backend.
///
/// - Sends the stored access token as a bearer token.
/// - On a 401 it refreshes the session once (concurrent requests share the
///   same refresh) and retries; if the refresh fails the session is cleared
///   and [onSessionExpired] fires so the app can return to the login screen.
/// - Errors surface as [ApiException] with the server's message.
class ApiClient {
  ApiClient({http.Client? httpClient, TokenStore? tokens})
      : _http = httpClient ?? http.Client(),
        _tokens = tokens ?? TokenStore.instance;

  static final ApiClient instance = ApiClient();

  final http.Client _http;
  final TokenStore _tokens;
  Future<bool>? _refreshing;

  static const _timeout = Duration(seconds: 25);

  /// Called once when the session can no longer be refreshed.
  void Function()? onSessionExpired;

  Future<dynamic> get(String path, {Map<String, String>? query}) => _send('GET', path, query: query);

  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body);

  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body: body);

  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body: body);

  Future<dynamic> delete(String path) => _send('DELETE', path);

  /// Calls that must not trigger refresh/retry (login, refresh itself).
  Future<dynamic> postPublic(String path, Object? body) =>
      _send('POST', path, body: body, authenticated: false);

  /// PUT raw bytes to a pre-signed storage URL (Supabase signed upload).
  Future<void> uploadToSignedUrl(String signedUrl, Uint8List bytes, String contentType) async {
    final http.Response res;
    try {
      res = await _http
          .put(Uri.parse(signedUrl), headers: {'Content-Type': contentType}, body: bytes)
          .timeout(const Duration(minutes: 5));
    } on SocketException catch (e) {
      throw ApiException(0, 'Upload failed: no connection (${e.message})');
    } on TimeoutException {
      throw ApiException(0, 'Upload timed out');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, 'Upload failed (${res.statusCode})');
    }
  }

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
    bool authenticated = true,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path').replace(
      queryParameters: (query == null || query.isEmpty) ? null : query,
    );
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (authenticated) {
      final token = await _tokens.accessToken;
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    final http.Response res;
    try {
      final req = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(await _http.send(req).timeout(_timeout));
    } on SocketException catch (e) {
      throw ApiException(0, 'Cannot reach the server. Check your connection. (${e.message})');
    } on TimeoutException {
      throw ApiException(0, 'The server took too long to respond.');
    } on http.ClientException catch (e) {
      throw ApiException(0, 'Network error: ${e.message}');
    }

    if (res.statusCode == 401 && authenticated && !isRetry) {
      if (await _refreshSession()) {
        return _send(method, path, body: body, query: query, isRetry: true);
      }
    }

    final decoded = _decode(res);
    if (res.statusCode >= 200 && res.statusCode < 300) return decoded;

    final message = _errorMessage(decoded) ?? 'Request failed (${res.statusCode})';
    final code = decoded is Map ? decoded['error']?.toString() : null;
    if (kDebugMode) debugPrint('API $method $path -> ${res.statusCode}: $message');
    throw ApiException(res.statusCode, message, code: code);
  }

  /// Single-flight refresh: every caller waiting on a 401 shares one request.
  Future<bool> _refreshSession() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _tokens.refreshToken;
    if (refresh == null || refresh.isEmpty) {
      await _expire();
      return false;
    }
    try {
      final res = await _send(
        'POST',
        '/auth/refresh',
        body: {'refreshToken': refresh},
        authenticated: false,
      ) as Map<String, dynamic>;
      await _tokens.save(
        accessToken: res['accessToken'] as String,
        refreshToken: res['refreshToken'] as String,
      );
      return true;
    } on ApiException catch (e) {
      // Network trouble is not a reason to log the user out.
      if (e.isNetwork) return false;
      await _expire();
      return false;
    }
  }

  Future<void> _expire() async {
    await _tokens.clear();
    onSessionExpired?.call();
  }

  static dynamic _decode(http.Response res) {
    if (res.body.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      return res.body;
    }
  }

  static String? _errorMessage(dynamic decoded) {
    if (decoded is Map) {
      final m = decoded['message'];
      if (m is String) return m;
      if (m is List && m.isNotEmpty) return m.join('\n');
    }
    return null;
  }
}
