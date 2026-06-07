import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:velan_spaces_flutter/core/services/quotation_pdf_service.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';
import 'package:velan_spaces_flutter/presentation/widgets/quotation/quote_share_sheet.dart';

/// Renders a quote to PDF and shows a live preview with built-in share / print /
/// save actions (from the `printing` package).
class QuotePreviewScreen extends ConsumerWidget {
  const QuotePreviewScreen({required this.quote, super.key});

  final QuoteEntity quote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(quotationSettingsProvider);
    final fileName =
        '${quote.quoteNumber.isEmpty ? 'quote' : quote.quoteNumber}_${quote.preparedForName}'
            .replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');

    return Scaffold(
      appBar: AppBar(
        title: Text(quote.quoteNumber.isEmpty ? 'Quote Preview' : quote.quoteNumber),
        actions: [
          IconButton(
            icon: const Icon(Icons.send_outlined),
            tooltip: 'Send to client',
            onPressed: () => showQuoteShareSheet(context, ref, quote),
          ),
        ],
      ),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (settings) {
          final s = settings ?? const QuotationSettingsEntity();
          return PdfPreview(
            build: (format) =>
                QuotationPdfService.build(quote: quote, settings: s),
            pdfFileName: '$fileName.pdf',
            canChangePageFormat: false,
            canChangeOrientation: false,
            loadingWidget: const Center(child: CircularProgressIndicator()),
          );
        },
      ),
    );
  }
}
