import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/app.dart';
import 'package:velan_spaces_flutter/firebase_options.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

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

  // Create the Riverpod container so we can restore session before the UI runs
  final container = ProviderContainer();

  // Attempt to restore the previous session from secure storage
  try {
    final restored = await container
        .read(authNotifierProvider.notifier)
        .restoreSession();
    print(restored ? '✅ Previous session restored' : 'ℹ️ No saved session');
  } catch (e) {
    print('⚠️ Session restore failed: $e');
  }

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const App(),
    ),
  );
}
