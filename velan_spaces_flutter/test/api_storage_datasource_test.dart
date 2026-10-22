import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:velan_spaces_flutter/data/datasources/api_storage_datasource.dart';

void main() {
  group('bucketForFolder', () {
    test('maps the app folder layout to storage buckets', () {
      expect(ApiStorageDatasource.bucketForFolder('projects/p1/designs'), 'designs');
      expect(ApiStorageDatasource.bucketForFolder('projects/p1/updates'), 'update-images');
      expect(ApiStorageDatasource.bucketForFolder('projects/p1/support/chat'), 'project-files');
      expect(ApiStorageDatasource.bucketForFolder('projects/p1/settlement_proofs'), 'project-files');
      expect(ApiStorageDatasource.bucketForFolder('/quotation/branding/'), 'quotations');
      expect(ApiStorageDatasource.bucketForFolder('users/u1'), 'avatars');
    });

    test('rejects unknown folders', () {
      expect(() => ApiStorageDatasource.bucketForFolder('random'), throwsArgumentError);
    });
  });

  group('sniffExtension', () {
    Uint8List bytes(List<int> b) => Uint8List.fromList([...b, ...List.filled(16, 0)]);

    test('recognises common upload types', () {
      expect(ApiStorageDatasource.sniffExtension(bytes([0xFF, 0xD8, 0xFF, 0xE0])), 'jpg');
      expect(ApiStorageDatasource.sniffExtension(bytes([0x89, 0x50, 0x4E, 0x47])), 'png');
      expect(ApiStorageDatasource.sniffExtension(bytes('%PDF-1.4'.codeUnits)), 'pdf');
      expect(ApiStorageDatasource.sniffExtension(bytes([0, 0, 0, 0x18, ...'ftypheic'.codeUnits])), 'heic');
      expect(ApiStorageDatasource.sniffExtension(bytes([0, 0, 0, 0x18, ...'ftypisom'.codeUnits])), 'mp4');
      expect(ApiStorageDatasource.sniffExtension(bytes([0, 0, 0, 0x14, ...'ftypqt  '.codeUnits])), 'mov');
    });

    test('returns null for unknown or short content', () {
      expect(ApiStorageDatasource.sniffExtension(Uint8List.fromList([1, 2, 3])), isNull);
      expect(ApiStorageDatasource.sniffExtension(bytes('hello'.codeUnits)), isNull);
    });
  });

  test('safeFileName strips unsafe characters', () {
    expect(ApiStorageDatasource.safeFileName('my photo (1).jpg'), 'my_photo__1_.jpg');
    expect(ApiStorageDatasource.safeFileName(''), 'file');
  });
}
