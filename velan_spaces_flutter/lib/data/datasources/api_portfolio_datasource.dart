import 'dart:typed_data';

import 'package:cross_file/cross_file.dart';
import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/domain/entities/portfolio_entity.dart';

/// Website portfolio (head only) over the Velan API.
class ApiPortfolioDatasource {
  ApiPortfolioDatasource(this._api);

  final ApiClient _api;

  static const topic = 'portfolio';

  Stream<List<PortfolioModel>> watchAll() => pollJson<List<PortfolioModel>>(
        fetchJson: () => _api.get('/portfolio'),
        map: (json) => (json as List? ?? const [])
            .whereType<Map>()
            .map((m) => PortfolioModel.fromApi(Map<String, dynamic>.from(m)))
            .toList(),
        topics: const [topic],
      );

  Future<String> add(PortfolioModel p) async {
    final res = await _api.post('/portfolio', {
      'title': p.projectName,
      if (p.description.isNotEmpty) 'description': p.description,
      if (p.category.isNotEmpty) 'category': p.category,
      if (p.location.isNotEmpty) 'location': p.location,
      if (_year(p.completionYear) != null) 'completionYear': _year(p.completionYear),
      if (p.coverImageUrl.isNotEmpty) 'coverImageUrl': p.coverImageUrl,
      if (p.imageUrls.isNotEmpty) 'imageUrls': p.imageUrls,
      'status': p.status,
      if (p.projectId.isNotEmpty) 'projectId': p.projectId,
    }) as Map<String, dynamic>;
    ApiInvalidation.instance.notify(topic);
    return res['id'] as String;
  }

  /// [data] uses the app's field names (projectName, completionYear as text);
  /// they are translated to the API's (title, integer year).
  Future<void> update(String id, Map<String, dynamic> data) async {
    final body = <String, dynamic>{};
    data.forEach((key, value) {
      switch (key) {
        case 'projectName':
          body['title'] = value;
        case 'completionYear':
          body['completionYear'] = value is int ? value : _year('$value');
        case 'description' || 'location' || 'coverImageUrl' || 'projectId':
          body[key] = (value is String && value.isEmpty) ? null : value;
        default:
          body[key] = value;
      }
    });
    await _api.patch('/portfolio/$id', body);
    ApiInvalidation.instance.notify(topic);
  }

  Future<void> delete(String id) async {
    await _api.delete('/portfolio/$id');
    ApiInvalidation.instance.notify(topic);
  }

  /// Sets the display order: each id's sortOrder becomes its index.
  Future<void> reorder(List<String> ids) async {
    await _api.put('/portfolio/order', {'ids': ids});
    ApiInvalidation.instance.notify(topic);
  }

  /// Uploads a JPEG/PNG/WebP/AVIF (<= 10 MB) via a signed URL and returns the
  /// public URL to store in coverImageUrl / imageUrls.
  Future<String> uploadImage(String filePath) async {
    final bytes = await XFile(filePath).readAsBytes();
    var name = filePath.split('/').last.split('?').first;
    final ext = _extensionOf(name);
    var type = _types[ext];
    if (type == null) {
      final sniffed = _sniff(bytes);
      if (sniffed == null) throw ArgumentError('Only JPEG, PNG, WebP or AVIF images are allowed');
      name = '$name.${sniffed.$1}';
      type = sniffed.$2;
    }
    return uploadImageBytes(bytes, name, type);
  }

  Future<String> uploadImageBytes(Uint8List bytes, String fileName, String contentType) async {
    final signed = await _api.post('/portfolio/uploads/sign', {
      'fileName': fileName,
      'contentType': contentType,
      'size': bytes.length,
    }) as Map<String, dynamic>;
    await _api.uploadToSignedUrl(signed['signedUrl'] as String, bytes, contentType);
    return signed['publicUrl'] as String;
  }

  static int? _year(String s) => int.tryParse(s.trim());

  static String _extensionOf(String n) => n.contains('.') ? n.split('.').last.toLowerCase() : '';

  static const _types = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'avif': 'image/avif',
  };

  static (String, String)? _sniff(Uint8List b) {
    bool at(int o, List<int> sig) =>
        b.length >= o + sig.length && List.generate(sig.length, (i) => b[o + i] == sig[i]).every((x) => x);
    if (at(0, [0xFF, 0xD8, 0xFF])) return ('jpg', 'image/jpeg');
    if (at(0, [0x89, 0x50, 0x4E, 0x47])) return ('png', 'image/png');
    if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return ('webp', 'image/webp');
    if (at(4, [0x66, 0x74, 0x79, 0x70]) && b.length >= 12 && String.fromCharCodes(b.sublist(8, 12)).startsWith('avi')) {
      return ('avif', 'image/avif');
    }
    return null;
  }
}
