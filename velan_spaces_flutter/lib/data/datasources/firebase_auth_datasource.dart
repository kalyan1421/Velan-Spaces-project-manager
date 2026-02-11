import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/datasources/auth_datasource.dart';

class FirebaseAuthDatasourceImpl implements AuthDatasource {
  final fb.FirebaseAuth _firebaseAuth;
  final FirebaseFirestore _firestore;

  FirebaseAuthDatasourceImpl({
    required fb.FirebaseAuth firebaseAuth,
    required FirebaseFirestore firestore,
  }) : _firebaseAuth = firebaseAuth, _firestore = firestore;

  @override
  Stream<fb.User?> get authStateChanges => _firebaseAuth.authStateChanges();

  @override
  Future<fb.UserCredential> signInWithEmailPassword({
    required String email,
    required String password,
  }) {
    return _firebaseAuth.signInWithEmailAndPassword(email: email, password: password);
  }

  @override
  Future<fb.UserCredential> signInAnonymously() {
    return _firebaseAuth.signInAnonymously();
  }

  @override
  Future<void> signOut() {
    return _firebaseAuth.signOut();
  }

  @override
  Future<String> getUserRole(String uid) async {
    try {
      final doc = await _firestore.collection('users').doc(uid).get();
      if (doc.exists && doc.data() != null) {
        return doc.data()!['role'] as String? ?? 'CLIENT';
      }
      return 'CLIENT';
    } catch (e) {
      return 'CLIENT'; 
    }
  }
}
