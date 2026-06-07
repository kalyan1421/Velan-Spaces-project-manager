import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/core/utils/template_applier.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_template_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quote_builder_screen.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quote_preview_screen.dart';
import 'package:velan_spaces_flutter/presentation/widgets/quotation/quote_share_sheet.dart';

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
        onPressed: () => _newQuote(context, ref),
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

  /// Offers a blank quote or a template to start from.
  void _newQuote(BuildContext context, WidgetRef ref) {
    final templates = ref.read(quoteTemplatesProvider).valueOrNull ?? [];
    if (templates.isEmpty) {
      _open(context, ref, null);
      return;
    }
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Start a quote',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            ListTile(
              leading: const Icon(Icons.note_add_outlined),
              title: const Text('Blank quote'),
              onTap: () {
                Navigator.pop(ctx);
                _open(context, ref, null);
              },
            ),
            const Divider(height: 1),
            ...templates.map((t) => ListTile(
                  leading: const Icon(Icons.dashboard_customize_outlined),
                  title: Text(t.name),
                  subtitle: Text('${t.lineCount} item(s) pre-filled'),
                  onTap: () {
                    Navigator.pop(ctx);
                    _open(context, ref, t);
                  },
                )),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  void _open(BuildContext context, WidgetRef ref, QuoteTemplateEntity? template) {
    List<QuoteSection>? sections;
    if (template != null) {
      final catalog = ref.read(activeCatalogProvider);
      final round =
          ref.read(quotationSettingsProvider).valueOrNull?.roundAmounts ?? true;
      sections = TemplateApplier.apply(template, catalog, round: round);
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            QuoteBuilderScreen(leadId: leadId, initialSections: sections),
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

  void _changeStatus(BuildContext context, WidgetRef ref) {
    const statuses = ['draft', 'sent', 'accepted', 'rejected'];
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Set status',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            ...statuses.map((s) => ListTile(
                  title: Text(s[0].toUpperCase() + s.substring(1)),
                  trailing: quote.status == s
                      ? const Icon(Icons.check, color: Color(0xFF22C55E))
                      : null,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await ref
                        .read(quotationControllerProvider.notifier)
                        .updateQuote(quote.copyWith(status: s));
                  },
                )),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

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
            if (quote.pdfUrl.isNotEmpty)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: Icon(Icons.cloud_done_outlined,
                    size: 16, color: Color(0xFF22C55E)),
              ),
            Text(FormatUtils.formatCurrency(quote.grandTotal),
                style: const TextStyle(fontWeight: FontWeight.bold)),
            PopupMenuButton<String>(
              onSelected: (v) async {
                final ctrl = ref.read(quotationControllerProvider.notifier);
                if (v == 'pdf') {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => QuotePreviewScreen(quote: quote),
                    ),
                  );
                } else if (v == 'send') {
                  showQuoteShareSheet(context, ref, quote);
                } else if (v == 'status') {
                  _changeStatus(context, ref);
                } else if (v == 'duplicate') {
                  final settings =
                      ref.read(quotationSettingsProvider).valueOrNull;
                  final number = await ctrl.nextQuoteNumber(
                      settings?.quoteNumberPrefix ?? 'QUO-', DateTime.now().year);
                  await ctrl.createQuote(quote.copyWith(
                      id: '', quoteNumber: number, status: 'draft'));
                } else if (v == 'delete') {
                  final ok = await showConfirmBottomSheet(context,
                      title: 'Delete quote?',
                      message: 'This cannot be undone.',
                      confirmLabel: 'Delete');
                  if (ok == true) {
                    await ctrl.deleteQuote(quote.leadId, quote.id);
                  }
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'pdf', child: Text('Preview PDF')),
                PopupMenuItem(value: 'send', child: Text('Send to Client')),
                PopupMenuItem(value: 'status', child: Text('Change Status')),
                PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
                PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
