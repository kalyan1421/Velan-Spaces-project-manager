import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/file_entity.dart';

class FileModel extends FileEntity {
  const FileModel({
    required super.id,
    required super.name,
    required super.storagePath,
    required super.category,
    required super.type,
    required super.size,
    required super.uploadedBy,
    required super.uploadedAt,
    super.version,
    required super.projectId,
    super.projectName,
    required super.title,
    super.approvalStatus,
    super.roomName,
  });

  factory FileModel.fromSnapshot(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return FileModel(
      id: doc.id,
      name: data['name'] ?? '',
      storagePath: data['storagePath'] ?? '',
      category: data['category'] ?? 'other',
      type: data['type'] ?? 'unknown',
      size: (data['size'] as num?)?.toInt() ?? 0,
      uploadedBy: data['uploadedBy'] ?? '',
      uploadedAt: (data['uploadedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      version: (data['version'] as num?)?.toInt() ?? 1,
      projectId: data['projectId'] ?? '',
      projectName: data['projectName'] ?? '',
      title: data['title'] ?? '',
      approvalStatus: data['approvalStatus'] ?? 'pending',
      roomName: data['roomName'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'storagePath': storagePath,
      'category': category,
      'type': type,
      'size': size,
      'uploadedBy': uploadedBy,
      'uploadedAt': Timestamp.fromDate(uploadedAt),
      'version': version,
      'projectId': projectId,
      'projectName': projectName,
      'title': title,
      'approvalStatus': approvalStatus,
      'roomName': roomName,
    };
  }

  factory FileModel.fromEntity(FileEntity entity) {
    return FileModel(
      id: entity.id,
      name: entity.name,
      storagePath: entity.storagePath,
      category: entity.category,
      type: entity.type,
      size: entity.size,
      uploadedBy: entity.uploadedBy,
      uploadedAt: entity.uploadedAt,
      version: entity.version,
      projectId: entity.projectId,
      projectName: entity.projectName,
      title: entity.title,
      approvalStatus: entity.approvalStatus,
      roomName: entity.roomName,
    );
  }
}
