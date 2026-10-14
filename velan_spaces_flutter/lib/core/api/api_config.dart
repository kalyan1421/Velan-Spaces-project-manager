import 'package:flutter/foundation.dart';

/// Where the app finds the Velan backend and optional Google sign-in config.
///
/// Set at build time, e.g.
///   flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
///   --dart-define=GOOGLE_IOS_CLIENT_ID=... --dart-define=GOOGLE_SERVER_CLIENT_ID=...
class ApiConfig {
  ApiConfig._();

  static const String _baseUrlOverride = String.fromEnvironment('API_BASE_URL');

  /// Defaults point at a backend running on the developer machine: the iOS
  /// simulator, macOS and web reach it as localhost; the Android emulator
  /// reaches the host machine as 10.0.2.2.
  static String get baseUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000/api/v1';
    }
    return 'http://localhost:3000/api/v1';
  }

  /// OAuth client IDs for Google sign-in. Empty = the Google button is hidden.
  static const String googleIosClientId = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
  static const String googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');

  /// The "web/server" client ID: Google puts it in the ID token audience on
  /// Android, which the backend checks against GOOGLE_CLIENT_IDS.
  static const String googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  static bool get googleSignInEnabled {
    if (kIsWeb) return googleWebClientId.isNotEmpty;
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return googleIosClientId.isNotEmpty;
      case TargetPlatform.android:
        return googleServerClientId.isNotEmpty;
      default:
        return false;
    }
  }

  /// How often live screens re-fetch while visible.
  static const Duration pollInterval = Duration(seconds: 8);
}
