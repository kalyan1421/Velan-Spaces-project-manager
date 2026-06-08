import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_template_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';

/// Admin screen to create/edit a reusable quote template (e.g. "Standard 3BHK").
class TemplateBuilderScreen extends ConsumerStatefulWidget {
  const TemplateBuilderScreen({this.existing, super.key});
  final QuoteTemplateEntity? existing;

  @override
  ConsumerState<TemplateBuilderScreen> createState() =>
      _TemplateBuilderScreenState();
}

class _TemplateBuilderScreenState extends ConsumerState<TemplateBuilderScreen> {
  final _name = TextEditingController();
  List<QuoteTemplateSection> _sections = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _name.text = widget.existing?.name ?? '';
    _sections = widget.existing?.sections ?? [];
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _addSection() async {
    final result = await showFormBottomSheet<_SectionDraft>(
      context: context,
      title: 'Add Section',
      initialSize: 0.5,
      child: const _SectionSheet(),
    );
    if (result != null) {
      setState(() => _sections = [
            ..._sections,
            QuoteTemplateSection(title: result.title, type: result.type),
          ]);
    }
  }

  Future<void> _addLine(int sectionIndex) async {
    final section = _sections[sectionIndex];
    final catalog = ref
        .read(activeCatalogProvider)
        .where((c) => c.itemType == section.type)
        .toList();
    if (catalog.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
                'No active ${section.type.label.toLowerCase()} items in the rate card')),
      );
      return;
    }
    final line = await showFormBottomSheet<QuoteTemplateLine>(
      context: context,
      title: 'Add ${section.type.label}',
      child: _TemplateLineSheet(catalog: catalog),
    );
    if (line != null) {
      setState(() {
        _sections = [..._sections];
        _sections[sectionIndex] =
            section.copyWith(lines: [...section.lines, line]);
      });
    }
  }

  void _removeLine(int s, int l) {
    final section = _sections[s];
    final lines = [...section.lines]..removeAt(l);
    setState(() {
      _sections = [..._sections];
      _sections[s] = section.copyWith(lines: lines);
    });
  }

  void _removeSection(int s) =>
      setState(() => _sections = [..._sections]..removeAt(s));

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a template name')),
      );
      return;
    }
    setState(() => _saving = true);
    final entity = QuoteTemplateEntity(
      id: widget.existing?.id ?? '',
      name: _name.text.trim(),
      sections: _sections,
    );
    final ctrl = ref.read(quotationControllerProvider.notifier);
    final ok = widget.existing == null
        ? await ctrl.addTemplate(entity)
        : await ctrl.updateTemplate(entity);
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) {
      Navigator.pop(context);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save template')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(widget.existing == null ? 'New Template' : 'Edit Template')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save),
            label: Text(_saving ? 'Saving…' : 'Save Template'),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(
                labelText: 'Template name (e.g. Standard 3BHK)',
                border: OutlineInputBorder(),
                isDense: true),
          ),
          const SizedBox(height: 16),
          ..._sections.asMap().entries.map((e) => _sectionCard(e.key, e.value)),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _addSection,
            icon: const Icon(Icons.add),
            label: const Text('Add Section / Room'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _sectionCard(int index, QuoteTemplateSection section) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(section.title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                      color: Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(6)),
                  child: Text(section.type.label,
                      style: const TextStyle(fontSize: 11)),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 20),
                  onPressed: () => _removeSection(index),
                ),
              ],
            ),
            ...section.lines.asMap().entries.map((e) {
              final line = e.value;
              final meta = line.itemType.pricingBasis == PricingBasis.area
                  ? '${line.defaultLengthMm?.toInt() ?? 0} × ${line.defaultHeightMm?.toInt() ?? 0} mm'
                  : '${line.defaultQty?.toStringAsFixed(0) ?? ''} ${line.uom}';
              return ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text(line.name),
                subtitle: Text(
                    [line.variantLabel, meta].where((x) => x.trim().isNotEmpty).join(' • '),
                    style: const TextStyle(fontSize: 12)),
                trailing: IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => _removeLine(index, e.key),
                ),
              );
            }),
            TextButton.icon(
              onPressed: () => _addLine(index),
              icon: const Icon(Icons.add, size: 18),
              label: Text('Add ${section.type.label}'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Section sheet ───────────────────────────────────────────────────────────
class _SectionDraft {
  _SectionDraft(this.title, this.type);
  final String title;
  final CatalogItemType type;
}

class _SectionSheet extends StatefulWidget {
  const _SectionSheet();
  @override
  State<_SectionSheet> createState() => _SectionSheetState();
}

class _SectionSheetState extends State<_SectionSheet> {
  final _title = TextEditingController();
  CatalogItemType _type = CatalogItemType.component;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _title,
            decoration: const InputDecoration(
                labelText: 'Section title (e.g. Modular Kitchen)',
                border: OutlineInputBorder(),
                isDense: true),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<CatalogItemType>(
            initialValue: _type,
            decoration: const InputDecoration(
                labelText: 'Item type', border: OutlineInputBorder(), isDense: true),
            items: CatalogItemType.values
                .map((t) => DropdownMenuItem(value: t, child: Text(t.label)))
                .toList(),
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              if (_title.text.trim().isEmpty) return;
              Navigator.pop(context, _SectionDraft(_title.text.trim(), _type));
            },
            child: const Text('Add Section'),
          ),
        ],
      ),
    );
  }
}

// ── Template line sheet (capture defaults, no live amount) ──────────────────
class _TemplateLineSheet extends StatefulWidget {
  const _TemplateLineSheet({required this.catalog});
  final List<CatalogItemEntity> catalog;

  @override
  State<_TemplateLineSheet> createState() => _TemplateLineSheetState();
}

class _TemplateLineSheetState extends State<_TemplateLineSheet> {
  CatalogItemEntity? _item;
  CatalogVariant? _variant;
  final _length = TextEditingController();
  final _height = TextEditingController();
  final _qty = TextEditingController(text: '1');

  @override
  void dispose() {
    _length.dispose();
    _height.dispose();
    _qty.dispose();
    super.dispose();
  }

  void _confirm() {
    if (_item == null) return;
    final basis = _item!.pricingBasis;
    final line = QuoteTemplateLine(
      catalogItemId: _item!.id,
      name: _item!.name,
      itemType: _item!.itemType,
      variantLabel: _variant?.label ?? '',
      defaultLengthMm:
          basis == PricingBasis.area ? double.tryParse(_length.text) : null,
      defaultHeightMm:
          basis == PricingBasis.area ? double.tryParse(_height.text) : null,
      defaultQty: basis == PricingBasis.area ? null : double.tryParse(_qty.text),
      uom: _item!.uom,
    );
    Navigator.pop(context, line);
  }

  @override
  Widget build(BuildContext context) {
    final basis = _item?.pricingBasis;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<CatalogItemEntity>(
          initialValue: _item,
          isExpanded: true,
          decoration: const InputDecoration(
              labelText: 'Catalog item', border: OutlineInputBorder(), isDense: true),
          items: widget.catalog
              .map((c) => DropdownMenuItem(
                  value: c, child: Text(c.name, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => setState(() {
            _item = v;
            _variant =
                v != null && v.variants.isNotEmpty ? v.variants.first : null;
          }),
        ),
        if (_item != null) ...[
          const SizedBox(height: 12),
          const Text('Default variant',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: _item!.variants
                .map((v) => ChoiceChip(
                      label: Text('${v.label} • ₹${v.rate.toStringAsFixed(0)}'),
                      selected: _variant == v,
                      onSelected: (_) => setState(() => _variant = v),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
          const Text('Default size / quantity',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (basis == PricingBasis.area)
            Row(
              children: [
                Expanded(child: _numField(_length, 'Length (mm)')),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('×'),
                ),
                Expanded(child: _numField(_height, 'Height (mm)')),
              ],
            )
          else
            _numField(_qty,
                basis == PricingBasis.uom ? 'Quantity (${_item!.uom})' : 'Quantity'),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _item != null && _variant != null ? _confirm : null,
            icon: const Icon(Icons.add),
            label: const Text('Add to Template'),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _numField(TextEditingController c, String label) {
    return TextField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
      decoration: InputDecoration(
          labelText: label, border: const OutlineInputBorder(), isDense: true),
    );
  }
}
