import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/app.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/core/app_version.dart';
import 'package:velan_spaces_flutter/core/deep_links.dart';
import 'package:velan_spaces_flutter/core/navigation/notification_navigation.dart';
import 'package:velan_spaces_flutter/core/router.dart';
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
  // Live screens poll the API; pause polling while the app is backgrounded.
  PollingLifecycle.instance.attach();
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

  // Forced-update check runs alongside session restore. It fails open: errors
  // and timeouts never block, and a late answer still shows the gate.
  final versionCheck = checkForRequiredUpdate().then((r) {
    if (r != null) container.read(updateRequirementProvider.notifier).state = r;
  });

  // Attempt to restore the previous session from secure storage
  String? fcmUserId;
  try {
    final restored = await container
        .read(authNotifierProvider.notifier)
        .restoreSession();
    if (kDebugMode) print(restored ? '✅ Previous session restored' : 'ℹ️ No saved session');

    if (restored) {
      final meta = container.read(currentUserMetaProvider);
      final userId = meta['id'] as String? ?? '';
      if (userId.isNotEmpty) fcmUserId = userId;
    }
  } catch (e) {
    if (kDebugMode) print('⚠️ Session restore failed: $e');
  }

  await versionCheck.timeout(const Duration(seconds: 2), onTimeout: () {});

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const App(),
    ),
  );

  unawaited(DeepLinkService.instance.start(container.read(routerProvider)));

  // Initialize FCM for the restored user AFTER the first frame is requested.
  // It talks to APNs/network, so it must never block app startup.
  if (fcmUserId != null) {
    unawaited(
      FCMService.instance
          .initialize(
            userId: fcmUserId,
            onNotificationTap: (target) => AppNavigation.open(target),
          )
          .timeout(const Duration(seconds: 30))
          .catchError((Object e) {
        if (kDebugMode) print('⚠️ FCM init failed: $e');
      }),
    );
  }
}

