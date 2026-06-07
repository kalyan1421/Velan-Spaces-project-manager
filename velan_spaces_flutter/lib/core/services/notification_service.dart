import 'package:velan_spaces_flutter/data/datasources/notification_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

/// Central service for sending in-app notifications.
/// All 8 trigger rules from the spec are implemented here.
///
/// Notification user-ID strategy:
///   Admin (head) → stored at users/'head'/notifications
///   Manager      → stored at users/{manager.id}/notifications  (Firestore doc ID)
///   Worker       → stored at users/{worker.id}/notifications
class NotificationService {
  final NotificationDatasource _ds;

  NotificationService(this._ds);

  // ───────────────────────────────────────────────────────────
  // Manager → Admin triggers
  // ───────────────────────────────────────────────────────────

  Future<void> notifyAdminOfUpdate({
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
  }) async {
    await _send(
      targetUserId: 'head',
      title: '📋 New project update',
      body: '$senderName posted an update on "$projectName"',
      type: 'update',
      projectId: projectId,
      projectName: projectName,
      senderName: senderName,
      senderId: senderId,
    );
  }

  Future<void> notifyAdminOfDesign({
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
    required String fileName,
  }) async {
    await _send(
      targetUserId: 'head',
      title: '📐 New design uploaded',
      body: '$senderName uploaded "$fileName" on "$projectName"',
      type: 'design',
      projectId: projectId,
      projectName: projectName,
      senderName: senderName,
      senderId: senderId,
    );
  }

  Future<void> notifyAdminOfSettlement({
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
    required double amount,
  }) async {
    final amountStr = '₹${amount.toStringAsFixed(0)}';
    await _send(
      targetUserId: 'head',
      title: '💰 Settlement logged',
      body: '$senderName added a $amountStr settlement on "$projectName"',
      type: 'settlement',
      projectId: projectId,
      projectName: projectName,
      senderName: senderName,
      senderId: senderId,
    );
  }

  Future<void> notifyAdminOfStatusChange({
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
    required String newStatus,
  }) async {
    await _send(
      targetUserId: 'head',
      title: '🔄 Project status changed',
      body: '$senderName marked "$projectName" as $newStatus',
      type: 'status_change',
      projectId: projectId,
      projectName: projectName,
      senderName: senderName,
      senderId: senderId,
    );
  }

  // ───────────────────────────────────────────────────────────
  // Admin → Manager triggers
  // ───────────────────────────────────────────────────────────

  Future<void> notifyManagerOfUpdate({
    required String managerId,
    required String projectId,
    required String projectName,
  }) async {
    if (managerId.isEmpty) return;
    await _send(
      targetUserId: managerId,
      title: '📋 Admin posted an update',
      body: 'Admin posted a new update on "$projectName"',
      type: 'update',
      projectId: projectId,
      projectName: projectName,
      senderName: 'Admin',
      senderId: 'head',
    );
  }

  Future<void> notifyManagerOfAssignment({
    required String managerId,
    required String projectId,
    required String projectName,
  }) async {
    if (managerId.isEmpty) return;
    await _send(
      targetUserId: managerId,
      title: '🏗️ New project assigned',
      body: 'Admin assigned you to "$projectName"',
      type: 'assignment',
      projectId: projectId,
      projectName: projectName,
      senderName: 'Admin',
      senderId: 'head',
    );
  }

  Future<void> notifyManagerOfWorkerAdded({
    required String managerId,
    required String projectId,
    required String projectName,
    required String workerName,
  }) async {
    if (managerId.isEmpty) return;
    await _send(
      targetUserId: managerId,
      title: '👷 Worker added to project',
      body: '$workerName was added to "$projectName"',
      type: 'worker',
      projectId: projectId,
      projectName: projectName,
      senderName: 'Admin',
      senderId: 'head',
    );
  }

  Future<void> notifyManagerOfSettlementAction({
    required String managerId,
    required String projectId,
    required String projectName,
    required String action, // e.g. 'approved', 'commented on'
  }) async {
    if (managerId.isEmpty) return;
    await _send(
      targetUserId: managerId,
      title: '💰 Settlement $action',
      body: 'Admin $action a settlement on "$projectName"',
      type: 'settlement',
      projectId: projectId,
      projectName: projectName,
      senderName: 'Admin',
      senderId: 'head',
    );
  }

  Future<void> notifyProjectManagersOfChat({
    required List<String> managerIds,
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
  }) async {
    for (final managerId in managerIds) {
      await _send(
        targetUserId: managerId,
        title: '💬 New project message',
        body: '$senderName sent a message in "$projectName"',
        type: 'chat',
        projectId: projectId,
        projectName: projectName,
        senderName: senderName,
        senderId: senderId,
      );
    }
  }

  Future<void> notifyAdminOfChat({
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
  }) async {
    await _send(
      targetUserId: 'head',
      title: '💬 New project message',
      body: '$senderName sent a message in "$projectName"',
      type: 'chat',
      projectId: projectId,
      projectName: projectName,
      senderName: senderName,
      senderId: senderId,
    );
  }

  Future<void> notifyAdminOfComplaint({
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
    required String complaintTitle,
  }) async {
    await _send(
      targetUserId: 'head',
      title: '📦 New complaint raised',
      body: '$senderName raised "$complaintTitle" on "$projectName"',
      type: 'complaint',
      projectId: projectId,
      projectName: projectName,
      senderName: senderName,
      senderId: senderId,
    );
  }

  Future<void> notifyManagersOfComplaint({
    required List<String> managerIds,
    required String projectId,
    required String projectName,
    required String senderName,
    required String senderId,
    required String complaintTitle,
  }) async {
    for (final managerId in managerIds) {
      await _send(
        targetUserId: managerId,
        title: '📦 Complaint update',
        body: '$senderName raised "$complaintTitle" on "$projectName"',
        type: 'complaint',
        projectId: projectId,
        projectName: projectName,
        senderName: senderName,
        senderId: senderId,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // Helper
  // ───────────────────────────────────────────────────────────

  /// Dispatches based on current role — must be called from trigger sites.
  Future<void> dispatchUpdateNotification({
    required UserRole senderRole,
    required String senderId,
    required String senderName,
    required String projectId,
    required String projectName,
    required List<String> managerIds,
  }) async {
    if (senderRole == UserRole.manager || senderRole == UserRole.worker) {
      // Non-admin posts → notify admin
      await notifyAdminOfUpdate(
        projectId: projectId,
        projectName: projectName,
        senderName: senderName,
        senderId: senderId,
      );
    } else if (senderRole == UserRole.head) {
      // Admin posts → notify all assigned managers
      for (final mId in managerIds) {
        await notifyManagerOfUpdate(
          managerId: mId,
          projectId: projectId,
          projectName: projectName,
        );
      }
    }
  }

  Future<void> _send({
    required String targetUserId,
    required String title,
    required String body,
    required String type,
    String projectId = '',
    String projectName = '',
    String senderName = '',
    String senderId = '',
  }) async {
    try {
      await _ds.sendNotification(
        targetUserId: targetUserId,
        title: title,
        body: body,
        type: type,
        projectId: projectId,
        projectName: projectName,
        senderName: senderName,
        senderId: senderId,
      );
    } catch (e) {
      // Fire-and-forget — notification failures should never block the user action
    }
  }
}
