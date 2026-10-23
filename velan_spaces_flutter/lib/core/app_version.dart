import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:velan_spaces_flutter/core/api/api_client.dart';

/// Store pages for the "Update required" screen.
class StoreLinks {
  StoreLinks._();

  /// Derived from the Android applicationId (android/app/build.gradle).
  static const String android =
      'https://play.google.com/store/apps/details?id=com.velanspaces.velan_spaces_flutter';

  // TODO(client): the App Store URL (https://apps.apple.com/app/id<APP_ID>) is
  // not in the repo yet. While empty the Update button shows a hint instead.
  static const String ios = '';

  static String get current =>
      defaultTargetPlatform == TargetPlatform.iOS ? ios : android;
}

/// Parses "1.2.3", "v1.2", "1.2.3+4", "1.2.3-beta" into numeric parts
/// (pre-release / build suffixes are ignored). Returns null if not a version.
List<int>? parseVersion(String? raw) {
  if (raw == null) return null;
  var v = raw.trim();
  if (v.startsWith('v') || v.startsWith('V')) v = v.substring(1);
  v = v.split('+').first.split('-').first;
  if (v.isEmpty) return null;
  final parts = <int>[];
  for (final p in v.split('.')) {
    final n = int.tryParse(p);
    if (n == null || n < 0) return null;
    parts.add(n);
  }
  return parts;
}

/// <0 if a<b, 0 if equal, >0 if a>b; null if either is not a valid version.
int? compareVersions(String? a, String? b) {
  final pa = parseVersion(a);
  final pb = parseVersion(b);
  if (pa == null || pb == null) return null;
  final len = pa.length > pb.length ? pa.length : pb.length;
  for (var i = 0; i < len; i++) {
    final x = i < pa.length ? pa[i] : 0;
    final y = i < pb.length ? pb[i] : 0;
    if (x != y) return x < y ? -1 : 1;
  }
  return 0;
}

/// True only when both versions are valid and installed < minimum.
bool isUpdateRequired(String? installed, String? minVersion) {
  final c = compareVersions(installed, minVersion);
  return c != null && c < 0;
}

class UpdateRequirement {
  const UpdateRequirement({required this.minVersion, required this.message});
  final String minVersion;
  final String message;
}

/// Set when the installed app is older than the server's minimum version.
final updateRequirementProvider = StateProvider<UpdateRequirement?>((_) => null);

/// Asks GET /public/app-version. Fails open: any error, timeout or malformed
/// response returns null (never blocks the user).
Future<UpdateRequirement?> checkForRequiredUpdate({ApiClient? api}) async {
  try {
    final res = await (api ?? ApiClient.instance)
        .getPublic('/public/app-version')
        .timeout(const Duration(seconds: 8));
    if (res is! Map) return null;
    final min = res['minVersion'];
    if (min is! String) return null;
    final info = await PackageInfo.fromPlatform();
    if (!isUpdateRequired(info.version, min)) return null;
    final msg = res['message'];
    return UpdateRequirement(
      minVersion: min,
      message: msg is String && msg.trim().isNotEmpty
          ? msg.trim()
          : 'A new version of Velan Spaces is available. Please update to continue.',
    );
  } catch (_) {
    return null;
  }
}

Future<bool> openStore() async {
  final url = StoreLinks.current;
  if (url.isEmpty) return false;
  try {
    return await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}
