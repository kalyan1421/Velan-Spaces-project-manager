
abstract class StorageDatasource {
  Future<String> uploadFile(String filePath, String folder);

  /// Uploads multiple files to [folder] and returns their download URLs,
  /// preserving the order of [filePaths].
  Future<List<String>> uploadMultipleFiles(List<String> filePaths, String folder);

  Future<void> deleteFile(String url);
}
