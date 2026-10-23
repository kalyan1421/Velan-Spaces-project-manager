import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/worker_entity.dart';

class WorkerModel extends WorkerEntity {
  const WorkerModel({
    required super.id,
    required super.name,
    super.phone,
    super.trade,
    super.password,
    super.assignedProjects,
    super.username,
  });

  /// From `GET /staff`. Passwords never leave the server any more.
  factory WorkerModel.fromApi(Map<String, dynamic> j) {
    return WorkerModel(
      id: apiString(j['id']),
      name: apiString(j['displayName']),
      phone: apiString(j['phone']),
      trade: apiString(j['trade']),
      assignedProjects: apiStringList(j['assignedProjects']),
      username: apiString(j['username']),
    );
  }

}
