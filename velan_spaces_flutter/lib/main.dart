import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/app.dart';
import 'package:velan_spaces_flutter/firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    print('✅ FIREBASE INITIALIZED SUCCESSFULLY');
  } catch (e) {
    print('❌ FIREBASE INITIALIZATION FAILED: $e');
  }
  
  FirebaseFirestore.instance.collection('projects').get().then((snap) {
    print("Projects count: ${snap.docs.length}");
    for (final d in snap.docs) {
      print(d.id);
    }
  }).catchError((e) => print("Firestore error: $e"));
  
  runApp(const ProviderScope(child: App()));
}
