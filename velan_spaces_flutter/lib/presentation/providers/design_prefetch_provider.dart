import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

final designPrefetchProvider = Provider.family<void, String>((ref, projectId) {
  final designsAsync = ref.watch(projectDesignsProvider(projectId));

  designsAsync.whenData((designs) {
    for (final design in designs) {
      if (design.fileUrl.isNotEmpty) {
        _cacheFile(design.fileUrl);
      }
    }
  });
});

Future<void> _cacheFile(String url) async {
  try {
    final fileInfo = await DefaultCacheManager().getFileFromCache(url);
    if (fileInfo == null) {
      // debugPrint('Prefetching design: $url');
      await DefaultCacheManager().downloadFile(url);
    }
  } catch (e) {
    // debugPrint('Failed to prefetch design: $e');
  }
}
