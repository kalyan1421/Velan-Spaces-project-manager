import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

/// Hosts whose https links (`https://<host>/invite/<token>`,
/// `https://<host>/reset-password/<token>`) open the app.
///
/// Set with --dart-define=APP_WEB_HOST=<host>. Left empty on purpose: the
/// production domain is still a TODO(client) in velan-web/src/content/site.ts,
/// so only the custom scheme `velanspaces://` works until it is confirmed.
/// For https links to open the app, ALSO publish the domain's
/// `.well-known/assetlinks.json` (Android App Links) and
/// `.well-known/apple-app-site-association` (iOS Universal Links), add the
/// https intent-filter in AndroidManifest.xml and the associated-domains
/// entitlement in ios/Runner/Runner.entitlements (both have commented templates).
class DeepLinkConfig {
  DeepLinkConfig._();
  static const String _host = String.fromEnvironment('APP_WEB_HOST');
  static List<String> get webHosts => _host.isEmpty ? const [] : [_host];
  static const String scheme = 'velanspaces';
}

final _tokenRe = RegExp(r'^[A-Za-z0-9_-]{43}$');

/// Maps an incoming link to an in-app route, or null if it is not ours.
String? deepLinkRoute(Uri uri, {List<String>? webHosts}) {
  String? kind;
  String? token;
  if (uri.scheme == DeepLinkConfig.scheme) {
    // velanspaces://invite/<token> -> host=invite, path=/<token>
    kind = uri.host;
    final segs = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    token = segs.isEmpty ? null : segs.first;
  } else if (uri.scheme == 'https') {
    final hosts = webHosts ?? DeepLinkConfig.webHosts;
    if (!hosts.contains(uri.host)) return null;
    final segs = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (segs.length != 2) return null;
    kind = segs[0];
    token = segs[1];
  } else {
    return null;
  }
  if (token == null || !_tokenRe.hasMatch(token)) return null;
  if (kind == 'invite') return '/invite/$token';
  if (kind == 'reset-password') return '/reset-password/$token';
  return null;
}

/// Listens for links (cold start and while running) and routes them.
class DeepLinkService {
  DeepLinkService._();
  static final DeepLinkService instance = DeepLinkService._();

  StreamSubscription<Uri>? _sub;
  String? _lastHandled;
  DateTime _lastAt = DateTime.fromMillisecondsSinceEpoch(0);

  Future<void> start(GoRouter router) async {
    if (_sub != null) return;
    final links = AppLinks();
    void handle(Uri uri) {
      final route = deepLinkRoute(uri);
      if (route == null) return;
      // The initial link can arrive via both the stream and getInitialLink.
      final now = DateTime.now();
      if (route == _lastHandled && now.difference(_lastAt).inSeconds < 3) return;
      _lastHandled = route;
      _lastAt = now;
      router.go(route);
    }

    try {
      _sub = links.uriLinkStream.listen(handle, onError: (_) {});
      final initial = await links.getInitialLink();
      if (initial != null) handle(initial);
    } catch (e) {
      if (kDebugMode) debugPrint('Deep links unavailable: $e');
    }
  }
}
