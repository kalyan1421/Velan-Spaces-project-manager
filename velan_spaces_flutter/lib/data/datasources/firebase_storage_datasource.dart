
import 'dart:io';
import 'package:flutter/foundation.dart';
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
    
    // Determine content type from extension
    final ext = originalName.split('.').last.toLowerCase();
    String contentType;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].contains(ext)) {
      contentType = 'image/$ext';
    } else if (['mp4', 'mov', 'avi', 'mkv'].contains(ext)) {
      contentType = 'video/$ext';
    } else if (ext == 'pdf') {
      contentType = 'application/pdf';
    } else {
      contentType = 'application/octet-stream';
    }

    final metadata = SettableMetadata(
      contentType: contentType,
      customMetadata: {
        'uploadedAt': DateTime.now().toIso8601String(),
      },
    );

    final ref = _storage.ref().child('$folder/$fileName');
    final uploadTask = ref.putFile(file, metadata);
    final snapshot = await uploadTask;
    return await snapshot.ref.getDownloadURL();
  }

  @override
  Future<List<String>> uploadMultipleFiles(
      List<String> filePaths, String folder) async {
    // Upload sequentially to keep memory/bandwidth predictable on mobile and
    // preserve the original order of the selected files.
    final urls = <String>[];
    for (final path in filePaths) {
      urls.add(await uploadFile(path, folder));
    }
    return urls;
  }

  @override
  Future<void> deleteFile(String url) async {
    try {
      final ref = _storage.refFromURL(url);
      await ref.delete();
    } catch (e) {
      // Ignore if file not found or already deleted
      if (kDebugMode) print('Error deleting file: $e');
    }
  }
}
