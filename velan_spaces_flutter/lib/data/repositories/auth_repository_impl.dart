import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:fpdart/fpdart.dart';
import 'package:velan_spaces_flutter/core/errors/failures.dart';
import 'package:velan_spaces_flutter/data/datasources/auth_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/user_entity.dart';
import 'package:velan_spaces_flutter/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthDatasource _datasource;

  AuthRepositoryImpl(this._datasource);

  @override
  Stream<UserEntity?> get authStateChanges {
    return _datasource.authStateChanges.asyncMap((fbUser) async {
      if (fbUser == null) {
        return null;
      }
      final role = await _datasource.getUserRole(fbUser.uid);
      return UserEntity(uid: fbUser.uid, email: fbUser.email, role: role);
    });
  }

  @override
  Future<Either<Failure, UserEntity>> signInWithEmailPassword({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _datasource.signInWithEmailPassword(email: email, password: password);
      final user = credential.user;
      if (user == null) {
        return left(const ServerFailure('Login failed, please try again.'));
      }
      final role = await _datasource.getUserRole(user.uid);
      return right(UserEntity(uid: user.uid, email: user.email, role: role));
    } on fb.FirebaseAuthException catch (e) {
      return left(ServerFailure(e.message ?? 'An unknown error occurred.'));
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> signInAnonymously() async {
    try {
      final credential = await _datasource.signInAnonymously();
      final user = credential.user;
      if (user == null) {
        return left(const ServerFailure('Anonymous login failed.'));
      }
      return right(UserEntity(uid: user.uid, email: null, role: 'anonymous'));
    } on fb.FirebaseAuthException catch (e) {
      return left(ServerFailure(e.message ?? 'An unknown error occurred.'));
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> signOut() async {
    try {
      return right(await _datasource.signOut());
    } on fb.FirebaseAuthException catch (e) {
      return left(ServerFailure(e.message ?? 'An unknown error occurred.'));
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }
  
  @override
  Future<Either<Failure, String>> getUserRole(String uid) async {
     try {
      return right(await _datasource.getUserRole(uid));
    } catch (e) {
      return left(ServerFailure(e.toString()));
    }
  }
}
