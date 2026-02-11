import 'package:fpdart/fpdart.dart';
import 'package:velan_spaces_flutter/core/errors/failures.dart';
import 'package:velan_spaces_flutter/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Stream<UserEntity?> get authStateChanges;

  Future<Either<Failure, UserEntity>> signInWithEmailPassword({
    required String email,
    required String password,
  });

  Future<Either<Failure, UserEntity>> signInAnonymously();
  
  Future<Either<Failure, void>> signOut();

  Future<Either<Failure, String>> getUserRole(String uid);
}
