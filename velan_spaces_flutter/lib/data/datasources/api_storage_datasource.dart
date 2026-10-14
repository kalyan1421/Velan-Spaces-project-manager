import 'dart:typed_data';

import 'package:cross_file/cross_file.dart';
import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/data/datasources/storage_datasource.dart';

/// Uploads go straight to Supabase Storage through a short-lived signed URL
/// the backend issues after checking role, bucket, path and project
/// membership. The value returned (and saved on rows) is a storage reference
/// `sb://<bucket>/<path>`; API responses turn references into signed URLs.
class ApiStorageDatasource implements StorageDatasource {
  ApiStorageDatasource(this._api);

  final ApiClient _api;

  /// [filePath] is a file path on mobile/desktop or a blob URL on web
  /// (image_picker); XFile reads both.
  @override
  Future<String> uploadFile(String filePath, String folder) async {
    final bytes = await XFile(filePath).readAsBytes();
    var name = filePath.split('/').last.split('?').first;
    // Web blob URLs carry no file name/extension: name it by its content,
    // since the server only accepts known file types.
    if (!_types.containsKey(_extensionOf(name))) {
      final sniffed = sniffExtension(bytes);
      if (sniffed != null) name = '$name.$sniffed';
    }
    return _upload(bytes, folder, name, contentTypeFor(name));
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

  static String _extensionOf(String fileName) =>
      fileName.contains('.') ? fileName.split('.').last.toLowerCase() : '';

  /// File type from the first bytes (magic numbers) for unnamed uploads.
  static String? sniffExtension(Uint8List b) {
    bool at(int offset, List<int> sig) =>
        b.length >= offset + sig.length &&
        List.generate(sig.length, (i) => b[offset + i] == sig[i]).every((x) => x);
    if (at(0, [0xFF, 0xD8, 0xFF])) return 'jpg';
    if (at(0, [0x89, 0x50, 0x4E, 0x47])) return 'png';
    if (at(0, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
    if (at(0, [0x47, 0x49, 0x46, 0x38])) return 'gif';
    if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return 'webp';
    if (at(4, [0x66, 0x74, 0x79, 0x70])) {
      // ISO media: brand at bytes 8-11 tells HEIC apart from MP4/MOV.
      final brand = b.length >= 12 ? String.fromCharCodes(b.sublist(8, 12)) : '';
      if (brand.startsWith('hei') || brand.startsWith('mif')) return 'heic';
      if (brand.startsWith('qt')) return 'mov';
      return 'mp4';
    }
    return null;
  }

  static String contentTypeFor(String fileName) =>
      _types[_extensionOf(fileName)] ?? 'application/octet-stream';

  static const Map<String, String> _types = {
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

  static String _trimSlashes(String s) => s.replaceAll(RegExp(r'^/+|/+$'), '');
}
