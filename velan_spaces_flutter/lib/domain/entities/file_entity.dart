import 'package:flutter/foundation.dart';

@immutable
class FileEntity {
  const FileEntity({
    required this.id,
    required this.name,
    required this.storagePath,
    required this.category, // 'contracts', 'drawings', 'invoices', 'reports', 'images'
    required this.type, // 'pdf', 'image'
    required this.size,
    required this.uploadedBy,
    required this.uploadedAt,
    this.version = 1,
    required this.projectId,
    this.projectName = '',
    required this.title,
    this.approvalStatus = 'pending',
    this.roomName = '',
  });

  final String id;
  final String name;
  final String storagePath;
  final String category;
  final String type;
  final int size;
  final String uploadedBy;
  final DateTime uploadedAt;
  final int version;
  final String projectId;
  final String projectName;
  final String title;
  final String approvalStatus;
  final String roomName;
}
