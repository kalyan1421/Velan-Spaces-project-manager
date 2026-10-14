import 'dart:io';
import 'dart:typed_data';

import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/data/datasources/storage_datasource.dart';

/// Uploads go straight to Supabase Storage through a short-lived signed URL
/// the backend issues after checking role, bucket, path and project
/// membership. The value returned (and saved on rows) is a storage reference
/// `sb://<bucket>/<path>`; API responses turn references into signed URLs.
class ApiStorageDatasource implements StorageDatasource {
  ApiStorageDatasource(this._api);

  final ApiClient _api;

  @override
  Future<String> uploadFile(String filePath, String folder) async {
    final originalName = filePath.split('/').last;
    final bytes = await File(filePath).readAsBytes();
    return _upload(bytes, folder, originalName, contentTypeFor(originalName));
  }

  @override
  Future<List<String>> uploadMultipleFiles(List<String> filePaths, String folder) async {
    // Sequential: predictable memory/bandwidth on mobile, keeps the order.
    final refs = <String>[];
    for (final path in filePaths) {
      refs.add(await uploadFile(path, folder));
    }
    return refs;
  }

  @override
  Future<String> uploadBytes(
    Uint8List bytes,
    String folder,
    String fileName, {
    String contentType = 'application/octet-stream',
  }) =>
      _upload(bytes, folder, fileName, contentType);

  /// Objects are deleted by the backend together with the row that owns them.
  @override
  Future<void> deleteFile(String url) async {}

  Future<String> _upload(Uint8List bytes, String folder, String fileName, String contentType) async {
    final bucket = bucketForFolder(folder);
    final path = '${_trimSlashes(folder)}/${DateTime.now().millisecondsSinceEpoch}_${safeFileName(fileName)}';
    final signed = await _api.post('/uploads/sign', {'bucket': bucket, 'path': path}) as Map<String, dynamic>;
    await _api.uploadToSignedUrl(signed['signedUrl'] as String, bytes, contentType);
    return 'sb://$bucket/$path';
  }

  /// The app's folder names (kept from the Firebase layout) -> storage bucket.
  static String bucketForFolder(String folder) {
    final f = _trimSlashes(folder);
    if (f.startsWith('quotation')) return 'quotations';
    if (f.startsWith('users/')) return 'avatars';
    final project = RegExp(r'^projects/[^/]+/([^/]+)').firstMatch(f);
    if (project != null) {
      switch (project.group(1)) {
        case 'designs':
          return 'designs';
        case 'updates':
          return 'update-images';
      }
      return 'project-files';
    }
    throw ArgumentError('No storage bucket for folder "$folder"');
  }

  static String safeFileName(String name) {
    final cleaned = name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    return cleaned.isEmpty ? 'file' : cleaned;
  }

  static String contentTypeFor(String fileName) {
    final ext = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : '';
    const types = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'heic': 'image/heic',
      'heif': 'image/heif',
      'pdf': 'application/pdf',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'm4v': 'video/x-m4v',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    return types[ext] ?? 'application/octet-stream';
  }

  static String _trimSlashes(String s) => s.replaceAll(RegExp(r'^/+|/+$'), '');
}
