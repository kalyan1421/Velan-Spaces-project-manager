import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/manager_entity.dart';

class ManagerModel extends ManagerEntity {
  const ManagerModel({
    required super.id,
    required super.name,
    super.phone,
    super.email,
    super.password,
    super.isSuspended,
    super.assignedProjects,
  });

  /// From `GET /staff`. Passwords never leave the server any more.
  factory ManagerModel.fromApi(Map<String, dynamic> j) {
    return ManagerModel(
      id: apiString(j['id']),
      name: apiString(j['displayName']),
      phone: apiString(j['phone']),
      email: apiString(j['email']),
      isSuspended: j['isSuspended'] == true,
      assignedProjects: apiStringList(j['assignedProjects']),
    );
  }

}
