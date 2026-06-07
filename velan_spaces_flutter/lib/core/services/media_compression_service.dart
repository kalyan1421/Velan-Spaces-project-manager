import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:video_compress/video_compress.dart';

/// Service that compresses images and videos before upload to prevent
/// OOM errors and Firebase Storage timeouts from raw 4K mobile media.
///
/// === Recommended Firebase Storage Media Strategy ===
///
/// IMAGES (.jpg, .png, .heic)
///   - Compress to ≤1920px wide, 85% JPEG quality via [compressImage]
///   - Typical reduction: 60–80% from original
///   - Stored under: projects/{id}/images/ or settlements/proofs/
///
/// PDFS (.pdf)
///   - PDFs are NOT compressed here (binary format, hard to reduce without full renderer)
///   - Upload raw. Firebase Storage handles chunked upload natively.
///   - For large PDFs (>10MB), consider splitting pages client-side or cloud function.
///   - Stored under: projects/{id}/files/
///
/// VIDEOS (.mp4, .mov)
///   - Compress to 720p MediumQuality via [compressVideo]
///   - Typical reduction: 70–85% from raw iPhone 4K video
///   - Stored under: projects/{id}/videos/
///
/// THUMBNAILS
///   - Generate thumbnails from video first frame using [generateVideoThumbnail]
///   - Compress thumbnail via [compressImage], store alongside video
///
/// Firebase Storage Path Conventions:
///   projects/{projectId}/images/{timestamp}_{filename}.jpg
///   projects/{projectId}/files/{timestamp}_{filename}.pdf
///   projects/{projectId}/videos/{timestamp}_{filename}.mp4
///   projects/{projectId}/settlement_proofs/{timestamp}.jpg

class MediaCompressionService {
  /// Max image dimension in pixels after compression (width or height)
  static const int _maxImageDimension = 1920;

  /// JPEG quality (0–100). 85 = high quality with ~60% size reduction.
  static const int _imageQuality = 85;

  /// For thumbnails and proof photos, use lower quality to save storage.
  static const int _thumbnailQuality = 70;
  static const int _maxThumbnailDimension = 800;

  // ─── Images ────────────────────────────────────────────────────────────────

  /// Compresses an image using flutter_image_compress.
  /// Returns the path to the compressed file, or the original path on failure.
  ///
  /// Best used for: site photos, proof images, design uploads.
  static Future<String> compressImage(
    String filePath, {
    int maxDimension = _maxImageDimension,
    int quality = _imageQuality,
  }) async {
    try {
      final file = File(filePath);
      final fileSize = await file.length();
      debugPrint('[MediaCompress] Original image: ${_formatBytes(fileSize)}');

      // Skip if already small enough (< 200 KB)
      if (fileSize < 200 * 1024) {
        debugPrint('[MediaCompress] Image already small, skipping compression');
        return filePath;
      }

      final lastDot = filePath.lastIndexOf('.');
      final outputPath = lastDot != -1
          ? '${filePath.substring(0, lastDot)}_compressed.jpg'
          : '${filePath}_compressed.jpg';

      final result = await FlutterImageCompress.compressAndGetFile(
        filePath,
        outputPath,
        minWidth: maxDimension,
        minHeight: maxDimension,
        quality: quality,
        format: CompressFormat.jpeg,
        keepExif: false, // Strip EXIF to save space and privacy
      );

      if (result != null) {
        final compressedSize = await File(result.path).length();
        final reduction = ((1 - compressedSize / fileSize) * 100).toStringAsFixed(1);
        debugPrint(
          '[MediaCompress] Compressed: ${_formatBytes(compressedSize)} ($reduction% reduction)',
        );
        return result.path;
      }

      debugPrint('[MediaCompress] Compression returned null, using original');
      return filePath;
    } catch (e) {
      debugPrint('[MediaCompress] Image compression failed: $e');
      return filePath; // Fallback to original
    }
  }

  /// Compresses an image specifically for use as a thumbnail or proof photo.
  /// Uses lower quality and max 800px to keep file sizes tiny.
  static Future<String> compressForThumbnail(String filePath) {
    return compressImage(
      filePath,
      maxDimension: _maxThumbnailDimension,
      quality: _thumbnailQuality,
    );
  }

  // ─── PDF ───────────────────────────────────────────────────────────────────

  /// Returns the PDF file path as-is (PDFs are not compressed client-side).
  ///
  /// PDFs are binary and cannot be meaningfully compressed in Dart without a
  /// full PDF renderer. Firebase Storage uses gzip transfer encoding anyway,
  /// so network transfer is compressed automatically.
  ///
  /// For very large PDFs (>10MB) consider:
  ///   1. A Cloud Function to process/split pages server-side
  ///   2. Using a PDF compressor API (e.g., ilovepdf.com API)
  static Future<String> preparePdf(String filePath) async {
    final file = File(filePath);
    final fileSize = await file.length();
    debugPrint('[MediaCompress] PDF size: ${_formatBytes(fileSize)} (no client-side compression)');
    return filePath;
  }

  // ─── Videos ────────────────────────────────────────────────────────────────

  /// Compresses a video file to 720p with medium quality.
  /// Returns the path to the compressed file, or the original path on failure.
  ///
  /// Best used for: project update videos, progress recordings.
  static Future<String> compressVideo(String filePath) async {
    try {
      final file = File(filePath);
      final fileSize = await file.length();
      debugPrint('[MediaCompress] Original video: ${_formatBytes(fileSize)}');

      final info = await VideoCompress.compressVideo(
        filePath,
        quality: VideoQuality.MediumQuality, // 720p
        deleteOrigin: false,
        includeAudio: true,
      );

      if (info != null && info.file != null) {
        final compressedSize = info.filesize ?? await info.file!.length();
        final reduction = ((1 - compressedSize / fileSize) * 100).toStringAsFixed(1);
        debugPrint(
          '[MediaCompress] Compressed video: ${_formatBytes(compressedSize)} ($reduction% reduction)',
        );
        return info.file!.path;
      }

      debugPrint('[MediaCompress] Video compression returned null, using original');
      return filePath;
    } catch (e) {
      debugPrint('[MediaCompress] Video compression failed: $e');
      return filePath;
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /// Cancel any in-progress video compression
  static Future<void> cancelCompression() async {
    await VideoCompress.cancelCompression();
  }

  /// Dispose video compression resources and clear cache
  static Future<void> dispose() async {
    await VideoCompress.deleteAllCache();
  }

  /// Returns true if the file at [path] is a PDF based on extension.
  static bool isPdf(String path) {
    return path.toLowerCase().endsWith('.pdf');
  }

  /// Returns true if the file at [path] is a video based on extension.
  static bool isVideo(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.mp4') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.avi') ||
        lower.endsWith('.mkv');
  }

  /// Determine media type and compress appropriately.
  /// Returns the path to the (possibly compressed) file.
  static Future<String> compress(String filePath) async {
    if (isPdf(filePath)) return preparePdf(filePath);
    if (isVideo(filePath)) return compressVideo(filePath);
    return compressImage(filePath);
  }

  static String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1048576) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1048576).toStringAsFixed(1)} MB';
  }
}
