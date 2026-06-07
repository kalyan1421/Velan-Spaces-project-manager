import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_template_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/template_builder_screen.dart';

/// Admin list of reusable quote templates.
class TemplateListScreen extends ConsumerWidget {
  const TemplateListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final templatesAsync = ref.watch(quoteTemplatesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Quote Templates')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'template_fab',
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const TemplateBuilderScreen()),
        ),
        icon: const Icon(Icons.add),
        label: const Text('New Template'),
      ),
      body: templatesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (templates) {
          if (templates.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No templates yet.\nBuild one (e.g. "Standard 3BHK") so new quotes start pre-filled.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            itemCount: templates.length,
            itemBuilder: (_, i) => _TemplateCard(template: templates[i]),
          );
        },
      ),
    );
  }
}

class _TemplateCard extends ConsumerWidget {
  const _TemplateCard({required this.template});
  final QuoteTemplateEntity template;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        title: Text(template.name,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
            '${template.sections.length} section(s) • ${template.lineCount} item(s)',
            style: const TextStyle(fontSize: 12)),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TemplateBuilderScreen(existing: template),
          ),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (v) async {
            if (v == 'delete') {
              final ok = await showConfirmBottomSheet(context,
                  title: 'Delete "${template.name}"?',
                  message: 'This cannot be undone.',
                  confirmLabel: 'Delete');
              if (ok == true) {
                final deleted = await ref
                    .read(quotationControllerProvider.notifier)
                    .deleteTemplate(template.id);
                if (!deleted && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Failed to delete template')),
                  );
                }
              }
            }
          },
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
        ),
      ),
    );
  }
}
