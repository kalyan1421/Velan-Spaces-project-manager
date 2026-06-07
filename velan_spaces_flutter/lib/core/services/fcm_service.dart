import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

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
///   2. Get FCM device token and save it to Firestore
///   3. Set up foreground notification display (heads-up on Android)
///   4. Handle background/terminated tap navigation via callback
///   5. Refresh token on rotation
class FCMService {
  FCMService._();
  static final FCMService instance = FCMService._();

  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotif = FlutterLocalNotificationsPlugin();

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
    required void Function(String projectId) onNotificationTap,
  }) async {
    // ─── 1. Background handler ─────────────────────────────────────────
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // ─── 2. Request OS permission ──────────────────────────────────────
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
        // Payload is projectId
        final projectId = response.payload ?? '';
        if (projectId.isNotEmpty) onNotificationTap(projectId);
      },
    );

    // Create high-priority Android channel
    if (Platform.isAndroid) {
      await _localNotif
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);
    }

    // ─── 5. Get & save FCM token ────────────────────────────────────────
    await _saveTokenForUser(userId);

    // Token refresh listener
    _fcm.onTokenRefresh.listen((newToken) {
      _saveTokenToFirestore(userId, newToken);
    });

    // ─── 6. Foreground message listener ────────────────────────────────
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('🔔 [FCM Foreground] ${message.notification?.title}: ${message.notification?.body}');
      }
      _showLocalNotification(message);
    });

    // ─── 7. Background tap (app in background) ─────────────────────────
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      if (kDebugMode) print('🔔 [FCM Tap] ${message.data}');
      final projectId = message.data['projectId'] as String? ?? '';
      if (projectId.isNotEmpty) onNotificationTap(projectId);
    });

    // ─── 8. Terminated tap (app was killed) ────────────────────────────
    final initial = await _fcm.getInitialMessage();
    if (initial != null) {
      final projectId = initial.data['projectId'] as String? ?? '';
      if (kDebugMode) print('🔔 [FCM Cold start] projectId=$projectId');
      if (projectId.isNotEmpty) {
        // Delay to let app fully initialize before navigating
        Future.delayed(const Duration(milliseconds: 800), () {
          onNotificationTap(projectId);
        });
      }
    }
  }

  /// Display a heads-up notification for foreground FCM messages
  void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    final projectId = message.data['projectId'] as String? ?? '';

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
      payload: projectId, // used for tap navigation
    );
  }

  /// Get the current FCM token and persist to Firestore
  Future<void> _saveTokenForUser(String userId) async {
    try {
      final token = await _fcm.getToken();
      if (token != null && userId.isNotEmpty) {
        await _saveTokenToFirestore(userId, token);
      }
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM token error: $e');
    }
  }

  Future<void> _saveTokenToFirestore(String userId, String token) async {
    if (userId.isEmpty) return;
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(userId)
          .set({
        'fcmTokens': FieldValue.arrayUnion([token]),
        'lastTokenUpdated': FieldValue.serverTimestamp(),
        'platform': Platform.isAndroid ? 'android' : 'ios',
      }, SetOptions(merge: true));
      if (kDebugMode) print('✅ FCM token saved for user: $userId');
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM token save failed: $e');
    }
  }

  /// Call this on logout to de-register the token
  Future<void> signOut(String userId) async {
    try {
      final token = await _fcm.getToken();
      if (token != null && userId.isNotEmpty) {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(userId)
            .update({
          'fcmTokens': FieldValue.arrayRemove([token]),
        });
      }
      await _fcm.deleteToken();
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM token cleanup failed: $e');
    }
  }
}
