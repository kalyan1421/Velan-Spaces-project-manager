import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quote_builder_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quote_preview_screen.dart';

/// Lists the quotations for a single lead/enquiry, with create / edit / delete.
class QuoteListScreen extends ConsumerWidget {
  const QuoteListScreen({required this.leadId, this.leadName = '', super.key});

  final String leadId;
  final String leadName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotesAsync = ref.watch(leadQuotesProvider(leadId));

    return Scaffold(
      appBar: AppBar(
        title: Text(leadName.isEmpty ? 'Quotations' : 'Quotes • $leadName'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'quote_list_fab',
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => QuoteBuilderScreen(leadId: leadId),
          ),
        ),
        icon: const Icon(Icons.add),
        label: const Text('New Quote'),
      ),
      body: quotesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (quotes) {
          if (quotes.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No quotes yet.\nTap "New Quote" to build one — amounts auto-calculate from the rate card.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            itemCount: quotes.length,
            itemBuilder: (_, i) => _QuoteCard(quote: quotes[i]),
          );
        },
      ),
    );
  }
}

class _QuoteCard extends ConsumerWidget {
  const _QuoteCard({required this.quote});
  final QuoteEntity quote;

  Color _statusColor() => switch (quote.status) {
        'accepted' => const Color(0xFF22C55E),
        'sent' => const Color(0xFFFFB347),
        'rejected' => Colors.red,
        _ => Colors.grey,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) =>
                QuoteBuilderScreen(leadId: quote.leadId, existing: quote),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                quote.quoteNumber.isEmpty ? 'Draft' : quote.quoteNumber,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                  color: _statusColor().withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6)),
              child: Text(quote.status.toUpperCase(),
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: _statusColor())),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${quote.preparedForName} • ${quote.sections.length} section(s)'
            '${quote.date != null ? ' • ${FormatUtils.formatDate(quote.date!)}' : ''}',
            style: const TextStyle(fontSize: 12),
          ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(FormatUtils.formatCurrency(quote.grandTotal),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            PopupMenuButton<String>(
              onSelected: (v) async {
                if (v == 'pdf') {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => QuotePreviewScreen(quote: quote),
                    ),
                  );
                } else if (v == 'delete') {
                  final ok = await showConfirmBottomSheet(context,
                      title: 'Delete quote?',
                      message: 'This cannot be undone.',
                      confirmLabel: 'Delete');
                  if (ok == true) {
                    await ref
                        .read(quotationControllerProvider.notifier)
                        .deleteQuote(quote.leadId, quote.id);
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'pdf', child: Text('Generate PDF')),
                PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
