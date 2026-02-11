import 'package:flutter/foundation.dart';

@immutable
class UserEntity {
  const UserEntity({
    required this.uid,
    this.email,
    this.role,
  });

  final String uid;
  final String? email;
  final String? role;
}
