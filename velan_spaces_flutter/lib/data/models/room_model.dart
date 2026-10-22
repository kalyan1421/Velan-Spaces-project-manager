import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/room_entity.dart';

class RoomModel extends RoomEntity {
  const RoomModel({
    required super.id,
    required super.name,
    super.assignedWorkerIds,
  });

  factory RoomModel.fromApi(Map<String, dynamic> j) {
    return RoomModel(
      id: apiString(j['id']),
      name: apiString(j['name']),
      assignedWorkerIds: apiStringList(j['assignedWorkerIds']),
    );
  }

  factory RoomModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return RoomModel(
      id: snap.id,
      name: data['name'] ?? '',
      assignedWorkerIds: List<String>.from(data['assignedWorkerIds'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'assignedWorkerIds': assignedWorkerIds,
    };
  }
}
