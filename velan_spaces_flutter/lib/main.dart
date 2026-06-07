import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/app.dart';
import 'package:velan_spaces_flutter/firebase_options.dart';
import 'package:velan_spaces_flutter/core/services/fcm_service.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

// Top-level background message handler — registered before runApp
@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    print('🔔 [BG] ${message.notification?.title}');
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    // Register background handler as early as possible
    FirebaseMessaging.onBackgroundMessage(_backgroundHandler);
    if (kDebugMode) print('✅ FIREBASE INITIALIZED SUCCESSFULLY');
  } catch (e) {
    if (kDebugMode) print('❌ FIREBASE INITIALIZATION FAILED: $e');
  }

  // Create the Riverpod container so we can restore session before the UI runs
  final container = ProviderContainer();

  // Attempt to restore the previous session from secure storage
  try {
    final restored = await container
        .read(authNotifierProvider.notifier)
        .restoreSession();
    if (kDebugMode) print(restored ? '✅ Previous session restored' : 'ℹ️ No saved session');

    // If session was restored, initialize FCM for this user
    if (restored) {
      final meta = container.read(currentUserMetaProvider);
      final userId = meta['id'] as String? ?? '';
      if (userId.isNotEmpty) {
        await FCMService.instance.initialize(
          userId: userId,
          onNotificationTap: (_) {
            // Navigation handled inside App widget via GoRouter
          },
        );
      }
    }
  } catch (e) {
    if (kDebugMode) print('⚠️ Session restore failed: $e');
  }

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const App(),
    ),
  );
}

