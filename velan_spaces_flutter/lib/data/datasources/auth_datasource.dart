import 'package:firebase_auth/firebase_auth.dart' as fb;

abstract class AuthDatasource {
  Stream<fb.User?> get authStateChanges;
  
  Future<fb.UserCredential> signInWithEmailPassword({
    required String email,
    required String password,
  });

  Future<fb.UserCredential> signInAnonymously();

  Future<void> signOut();

  Future<String> getUserRole(String uid);
}
