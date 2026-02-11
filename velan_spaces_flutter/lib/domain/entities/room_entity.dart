import 'package:flutter/foundation.dart';

@immutable
class RoomEntity {
  const RoomEntity({
    required this.id,
    required this.name,
    this.assignedWorkerIds = const [],
  });

  final String id;
  final String name;
  final List<String> assignedWorkerIds;
}
