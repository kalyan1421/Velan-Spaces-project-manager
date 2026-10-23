import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/navigation/notification_navigation.dart';

/// Background message handler — MUST be a top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialised when this is called from background
  if (kDebugMode) {
    print('🔔 [FCM Background] ${message.notification?.title}: ${message.notification?.body}');
  }
}

/// Centralized FCM service for Velan Spaces (project: velan-spaces-constructions)
///
/// Responsibilities:
///   1. Request OS-level notification permission
///   2. Get FCM device token and register it with the backend
///   3. Set up foreground notification display (heads-up on Android)
///   4. Handle background/terminated tap navigation via callback
///   5. Refresh token on rotation
class FCMService {
  FCMService._();
  static final FCMService instance = FCMService._();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotif = FlutterLocalNotificationsPlugin();

  // Listeners are registered once per initialize() and cancelled before the
  // next one, so repeated sign-ins never duplicate them.
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _messageSub;
  StreamSubscription<RemoteMessage>? _openedSub;
  bool _initialMessageHandled = false;

  Future<void> _cancelListeners() async {
    final subs = [_tokenRefreshSub, _messageSub, _openedSub];
    _tokenRefreshSub = null;
    _messageSub = null;
    _openedSub = null;
    for (final s in subs) {
      await s?.cancel();
    }
  }

  /// Android notification channel — must match AndroidManifest meta-data
  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'velan_spaces_notifications',
    'Velan Spaces',
    description: 'Project updates, assignments and settlement notifications',
    importance: Importance.high,
    playSound: true,
  );

  /// Call once after login. Pass the user's stable notification-path ID
  /// (e.g. 'head' for admin, manager.id for managers).
  Future<void> initialize({
    required String userId,
    required void Function(NotificationTarget target) onNotificationTap,
  }) async {
    await _cancelListeners();
    // ─── 1. Request OS permission ──────────────────────────────────────
    // Note: onBackgroundMessage is registered once in main.dart (top-level)
    final settings = await _fcm.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    if (kDebugMode) {
      print('🔔 FCM permission: ${settings.authorizationStatus}');
    }

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      if (kDebugMode) print('⚠️ FCM permission denied by user');
      return;
    }

    // ─── 3. iOS foreground presentation options ─────────────────────────
    await _fcm.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // ─── 4. Set up local notification plugin (Android heads-up) ────────
    await _localNotif.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false, // already requested above
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (response) {
        onNotificationTap(NotificationTarget.fromPayload(response.payload));
      },
    );

    // Create high-priority Android channel
    if (!kIsWeb && Platform.isAndroid) {
      await _localNotif
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);
    }

    // ─── 5. Get & save FCM token ────────────────────────────────────────
    await _saveTokenForUser(userId);

    // Token refresh listener
    _tokenRefreshSub = _fcm.onTokenRefresh.listen((newToken) {
      _registerToken(userId, newToken);
    });

    // ─── 6. Foreground message listener ────────────────────────────────
    _messageSub = FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('🔔 [FCM Foreground] ${message.notification?.title}: ${message.notification?.body}');
      }
      _showLocalNotification(message);
    });

    // ─── 7. Background tap (app in background) ─────────────────────────
    _openedSub = FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      if (kDebugMode) print('🔔 [FCM Tap] ${message.data}');
      onNotificationTap(NotificationTarget.fromMap(message.data));
    });

    // ─── 8. Terminated tap (app was killed) ────────────────────────────
    final initial = _initialMessageHandled ? null : await _fcm.getInitialMessage();
    if (initial != null) {
      _initialMessageHandled = true; // only the cold-start tap, once
      final target = NotificationTarget.fromMap(initial.data);
      if (kDebugMode) print('🔔 [FCM Cold start] ${initial.data}');
      // Delay to let app fully initialize before navigating
      Future.delayed(const Duration(milliseconds: 800), () => onNotificationTap(target));
    }
  }

  /// Display a heads-up notification for foreground FCM messages
  void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    final payload = NotificationTarget.fromMap(message.data).toPayload();

    _localNotif.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          color: const Color(0xFFFFB347),
          playSound: true,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: payload, // used for tap navigation
    );
  }

  /// Get the current FCM token and register it with the backend.
  Future<void> _saveTokenForUser(String userId) async {
    try {
      final token = await _fcm.getToken();
      if (token != null && userId.isNotEmpty) {
        await _registerToken(userId, token);
      }
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM token error: $e');
    }
  }

  /// The backend sends pushes to every token registered for the user.
  Future<void> _registerToken(String userId, String token) async {
    if (userId.isEmpty) return;
    try {
      await ApiClient.instance.post('/device-tokens', {
        'fcmToken': token,
        'platform': kIsWeb ? 'web' : (Platform.isAndroid ? 'android' : 'ios'),
      });
      if (kDebugMode) print('✅ FCM token registered for user: $userId');
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM token registration failed: $e');
    }
  }

  /// Call on logout, while the session is still valid, to stop pushes to
  /// this device.
  Future<void> signOut(String userId) async {
    await _cancelListeners();
    try {
      final token = await _fcm.getToken();
      if (token != null && userId.isNotEmpty) {
        await ApiClient.instance.post('/device-tokens/remove', {'fcmToken': token});
      }
      await _fcm.deleteToken();
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM token cleanup failed: $e');
    }
  }
}
