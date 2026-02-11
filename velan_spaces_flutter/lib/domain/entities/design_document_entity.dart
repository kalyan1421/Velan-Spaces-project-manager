import 'package:flutter/foundation.dart';

@immutable
class DesignDocumentEntity {
  const DesignDocumentEntity({
    required this.id,
    required this.title,
    required this.fileUrl,
    this.type = '2D',
    this.approvalStatus = const DesignApprovalStatus(),
    this.postedBy = '',
    this.timestamp,
    this.roomName = '',
    this.projectId = '',
  });

  final String id;
  final String title;
  final String fileUrl;
  final String type; // '2D' or '3D'
  final DesignApprovalStatus approvalStatus;
  final String postedBy;
  final DateTime? timestamp;
  final String roomName;
  final String projectId;
}

@immutable
class DesignApprovalStatus {
  const DesignApprovalStatus({
    this.approved = false,
    this.required = false,
  });

  final bool approved;
  final bool required;
}
