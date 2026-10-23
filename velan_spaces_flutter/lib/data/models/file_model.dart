import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory FileModel.fromApi(Map<String, dynamic> j) {
    return FileModel(
      id: apiString(j['id']),
      name: apiString(j['name']),
      storagePath: apiString(j['storagePath']),
      category: apiString(j['category'], 'other'),
      type: apiString(j['type'], 'unknown'),
      size: apiInt(j['size']) ?? 0,
      uploadedBy: apiString(j['uploadedByName'], apiString(j['uploadedBy'])),
      uploadedAt: apiDate(j['uploadedAt']) ?? DateTime.now(),
      version: apiInt(j['version']) ?? 1,
      projectId: apiString(j['projectId']),
      projectName: '',
      title: apiString(j['title']),
      approvalStatus: apiString(j['approvalStatus'], 'pending'),
      roomName: apiString(j['roomName']),
    );
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
