import 'package:flutter/material.dart';
import 'package:flutter_cached_pdfview/flutter_cached_pdfview.dart';
import 'package:photo_view/photo_view.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:velan_spaces_flutter/core/theme.dart';
import 'package:cached_network_image/cached_network_image.dart';

class DesignViewerScreen extends StatelessWidget {
  const DesignViewerScreen({
    required this.url,
    required this.title,
    required this.isPdf,
    super.key,
  });

  final String url;
  final String title;
  final bool isPdf;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontSize: 16)),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.open_in_new),
            onPressed: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
            tooltip: 'Open in External App',
          ),
        ],
      ),
      body: isPdf ? _buildPdfView() : _buildImageView(),
    );
  }

  Widget _buildPdfView() {
    return PDF().fromUrl(
      url,
      placeholder: (progress) => Center(child: Text('$progress %')),
      errorWidget: (error) => Center(child: Text("Failed to load PDF: $error")),
    );
  }

  Widget _buildImageView() {
    return PhotoView(
      imageProvider: CachedNetworkImageProvider(url),
      loadingBuilder: (context, event) => const Center(
        child: CircularProgressIndicator(),
      ),
      backgroundDecoration: const BoxDecoration(color: Colors.white),
      minScale: PhotoViewComputedScale.contained,
      maxScale: PhotoViewComputedScale.covered * 2,
    );
  }
}
