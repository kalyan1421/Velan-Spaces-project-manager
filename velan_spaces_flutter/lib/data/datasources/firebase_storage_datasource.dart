
import 'dart:io';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:velan_spaces_flutter/data/datasources/storage_datasource.dart';

class FirebaseStorageDatasourceImpl implements StorageDatasource {
  final FirebaseStorage _storage;

  FirebaseStorageDatasourceImpl(this._storage);

  @override
  Future<String> uploadFile(String filePath, String folder) async {
    final file = File(filePath);
    // Create a unique filename to avoid overwrites
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final originalName = filePath.split('/').last;
    final fileName = '${timestamp}_$originalName';
    
    final ref = _storage.ref().child('$folder/$fileName');
    final uploadTask = ref.putFile(file);
    final snapshot = await uploadTask;
    return await snapshot.ref.getDownloadURL();
  }

  @override
  Future<void> deleteFile(String url) async {
    try {
      final ref = _storage.refFromURL(url);
      await ref.delete();
    } catch (e) {
      // Ignore if file not found or already deleted
      print('Error deleting file: $e');
    }
  }
}
