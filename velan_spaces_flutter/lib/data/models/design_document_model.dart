import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory DesignDocumentModel.fromApi(Map<String, dynamic> j) {
    return DesignDocumentModel(
      id: apiString(j['id']),
      title: apiString(j['title']),
      fileUrl: apiString(j['fileUrl']),
      type: apiString(j['type'], '2D'),
      postedBy: apiString(j['postedByName']),
      timestamp: apiDate(j['createdAt']),
      roomName: apiString(j['roomName']),
      projectId: apiString(j['projectId']),
      approvalStatus: DesignApprovalStatus(
        approved: j['approvalApproved'] == true,
        required: j['approvalRequired'] == true,
      ),
    );
  }
}
