import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/design_document_entity.dart';

class DesignDocumentModel extends DesignDocumentEntity {
  const DesignDocumentModel({
    required super.id,
    required super.title,
    required super.fileUrl,
    super.type,
    super.approvalStatus,
    super.postedBy,
    super.timestamp,
    super.roomName,
    super.projectId,
  });

  factory DesignDocumentModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return DesignDocumentModel(
      id: snap.id,
      title: data['title'] ?? '',
      fileUrl: data['url'] ?? data['fileUrl'] ?? '',
      type: data['type'] ?? '2D',
      postedBy: data['postedBy'] ?? '',
      timestamp: (data['timestamp'] as Timestamp?)?.toDate(),
      roomName: data['roomName'] ?? '',
      projectId: data['projectId'] ?? '',
      approvalStatus: _parseApprovalStatus(data['approvalStatus']),
    );
  }

  static DesignApprovalStatus _parseApprovalStatus(dynamic data) {
    if (data is Map<String, dynamic>) {
      return DesignApprovalStatus(
        approved: data['approved'] ?? false,
        required: data['required'] ?? false,
      );
    }
    return const DesignApprovalStatus();
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'url': fileUrl,
      'type': type,
      'postedBy': postedBy,
      'timestamp': timestamp != null ? Timestamp.fromDate(timestamp!) : null,
      'roomName': roomName,
      'projectId': projectId,
      'approvalStatus': {
        'approved': approvalStatus.approved,
        'required': approvalStatus.required,
      },
    };
  }
}
