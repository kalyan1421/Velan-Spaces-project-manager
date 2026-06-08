import 'dart:typed_data';

abstract class StorageDatasource {
  Future<String> uploadFile(String filePath, String folder);

  /// Uploads multiple files to [folder] and returns their download URLs,
  /// preserving the order of [filePaths].
  Future<List<String>> uploadMultipleFiles(List<String> filePaths, String folder);

  /// Uploads raw [bytes] (e.g. a generated PDF) and returns the download URL.
  Future<String> uploadBytes(
    Uint8List bytes,
    String folder,
    String fileName, {
    String contentType = 'application/octet-stream',
  });

  Future<void> deleteFile(String url);
}
