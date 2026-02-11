
abstract class StorageDatasource {
  Future<String> uploadFile(String filePath, String folder);
  Future<void> deleteFile(String url);
}
