import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';

/// Generates + uploads the quote PDF, then lets the admin/manager send it to the
/// client via WhatsApp, email, the native share sheet, or a copyable download
/// link. The hosted link is stored on the quote so the client can download it.
Future<void> showQuoteShareSheet(
    BuildContext context, WidgetRef ref, QuoteEntity quote) async {
  final settings = ref.read(quotationSettingsProvider).valueOrNull ??
      const QuotationSettingsEntity();
  final ctrl = ref.read(quotationControllerProvider.notifier);

  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => const Center(child: CircularProgressIndicator()),
  );

  Uint8List? bytes;
  String? url;
  try {
    bytes = await ctrl.buildPdfBytes(quote, settings);
    url = await ctrl.uploadPdfBytes(quote, bytes);
  } catch (_) {
    bytes = null;
  }

  if (!context.mounted) return;
  Navigator.pop(context); // close progress

  if (bytes == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Failed to generate PDF')),
    );
    return;
  }

  final pdfBytes = bytes;
  final link = url ?? '';
  final fileName =
      '${quote.quoteNumber.isEmpty ? 'quote' : quote.quoteNumber}.pdf'
          .replaceAll(RegExp(r'[^A-Za-z0-9_.-]'), '_');

  String message() {
    final total = FormatUtils.formatCurrency(quote.grandTotal);
    final company = settings.companyName.isEmpty ? 'us' : settings.companyName;
    final buf = StringBuffer()
      ..writeln('Dear ${quote.preparedForName},')
      ..writeln()
      ..writeln(
          'Please find your quotation ${quote.quoteNumber} from $company.')
      ..writeln('Total: $total');
    if (link.isNotEmpty) {
      buf
        ..writeln()
        ..writeln('Download: $link');
    }
    buf
      ..writeln()
      ..writeln('Thank you.');
    return buf.toString();
  }

  if (!context.mounted) return;
  showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Send ${quote.quoteNumber} to client',
                style:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ),
          if (quote.preparedForPhone.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.chat, color: Color(0xFF25D366)),
              title: const Text('WhatsApp'),
              subtitle: Text(quote.preparedForPhone),
              onTap: () {
                Navigator.pop(ctx);
                _openWhatsApp(context, quote.preparedForPhone, message());
              },
            ),
          if (quote.preparedForEmail.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.email_outlined, color: Color(0xFFEA4335)),
              title: const Text('Email'),
              subtitle: Text(quote.preparedForEmail),
              onTap: () {
                Navigator.pop(ctx);
                _openEmail(
                  context,
                  quote.preparedForEmail,
                  'Quotation ${quote.quoteNumber} — ${settings.companyName}',
                  message(),
                );
              },
            ),
          ListTile(
            leading: const Icon(Icons.ios_share),
            title: const Text('Share file…'),
            subtitle: const Text('Attach the PDF via any app'),
            onTap: () {
              Navigator.pop(ctx);
              Printing.sharePdf(bytes: pdfBytes, filename: fileName);
            },
          ),
          if (link.isNotEmpty) ...[
            ListTile(
              leading: const Icon(Icons.link),
              title: const Text('Copy download link'),
              onTap: () {
                Navigator.pop(ctx);
                Clipboard.setData(ClipboardData(text: link));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Download link copied')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.open_in_new),
              title: const Text('Open / download PDF'),
              onTap: () {
                Navigator.pop(ctx);
                launchUrl(Uri.parse(link),
                    mode: LaunchMode.externalApplication);
              },
            ),
          ],
          const SizedBox(height: 12),
        ],
      ),
    ),
  );
}

void _openWhatsApp(BuildContext context, String phone, String message) async {
  var digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.length == 10) digits = '91$digits'; // default to India code
  final uri =
      Uri.parse('https://wa.me/$digits?text=${Uri.encodeComponent(message)}');
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Could not open WhatsApp')),
    );
  }
}

void _openEmail(
    BuildContext context, String email, String subject, String body) async {
  final uri = Uri(
    scheme: 'mailto',
    path: email,
    query:
        'subject=${Uri.encodeComponent(subject)}&body=${Uri.encodeComponent(body)}',
  );
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No email app found')),
    );
  }
}
