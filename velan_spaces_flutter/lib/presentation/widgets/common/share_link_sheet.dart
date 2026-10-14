import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';

/// Shows a one-time link (client invite, password reset) with copy and
/// WhatsApp share. The link is only shown here — the server keeps a hash.
Future<void> showShareLinkSheet(
  BuildContext context, {
  required String title,
  required String message,
  required String url,
  required String shareText,
}) {
  return showFormBottomSheet(
    context: context,
    title: title,
    initialSize: 0.55,
    child: _ShareLinkBody(message: message, url: url, shareText: shareText),
  );
}

class _ShareLinkBody extends StatelessWidget {
  const _ShareLinkBody({required this.message, required this.url, required this.shareText});

  final String message;
  final String url;
  final String shareText;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied')));
    }
  }

  Future<void> _whatsapp(BuildContext context) async {
    final uri = Uri.parse('https://wa.me/?text=${Uri.encodeComponent('$shareText\n$url')}');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open WhatsApp')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(message, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(12),
          ),
          child: SelectableText(url, style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
        ),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          key: const Key('share-link-copy'),
          onPressed: () => _copy(context),
          icon: const Icon(Icons.copy),
          label: const Text('Copy link'),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _whatsapp(context),
          icon: const Icon(Icons.chat_outlined),
          label: const Text('Share on WhatsApp'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'The link works once. Anyone with it can use it, so share it only with this person.',
          style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
        ),
      ],
    );
  }
}
