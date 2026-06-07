import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';

/// Admin rate card: list of catalog items grouped by section, each with priced
/// variants. Drives the quote builder's auto-calculation.
class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(catalogProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Rate Card')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'catalog_fab',
        onPressed: () => _openEditor(context, ref, null),
        icon: const Icon(Icons.add),
        label: const Text('Add Item'),
      ),
      body: catalogAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No rate card items yet.\nAdd components, accessories and services with their rates — quotes will auto-price from here.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          // Group by defaultSection (fallback to item type label).
          final groups = <String, List<CatalogItemEntity>>{};
          for (final it in items) {
            final key = it.defaultSection.isNotEmpty
                ? it.defaultSection
                : it.itemType.label;
            groups.putIfAbsent(key, () => []).add(it);
          }
          final keys = groups.keys.toList()..sort();
          return ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            children: [
              for (final k in keys) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 12, 8, 6),
                  child: Text(k.toUpperCase(),
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600)),
                ),
                ...groups[k]!.map((it) => _CatalogTile(item: it)),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _CatalogTile extends ConsumerWidget {
  const _CatalogTile({required this.item});
  final CatalogItemEntity item;

  String get _rateSummary {
    if (item.variants.isEmpty) return 'No rate set';
    final unit = switch (item.itemType) {
      CatalogItemType.component => '/sqft',
      CatalogItemType.accessory => '/unit',
      CatalogItemType.service => '/${item.uom.isEmpty ? 'uom' : item.uom}',
    };
    final v = item.variants.first;
    final extra = item.variants.length > 1 ? ' +${item.variants.length - 1}' : '';
    return '${v.label}: ₹${v.rate.toStringAsFixed(0)}$unit$extra';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        title: Row(
          children: [
            Expanded(
              child: Text(item.name,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            if (!item.active)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(4)),
                child: const Text('Inactive', style: TextStyle(fontSize: 10)),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${item.itemType.label} • $_rateSummary',
                style: const TextStyle(fontSize: 12)),
          ],
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (v) async {
            if (v == 'edit') {
              _openEditor(context, ref, item);
            } else if (v == 'delete') {
              final ok = await showConfirmBottomSheet(context,
                  title: 'Delete "${item.name}"?',
                  message: 'This removes it from the rate card.',
                  confirmLabel: 'Delete');
              if (ok == true) {
                await ref
                    .read(quotationControllerProvider.notifier)
                    .deleteCatalogItem(item.id);
              }
            }
          },
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
        ),
        onTap: () => _openEditor(context, ref, item),
      ),
    );
  }
}

void _openEditor(BuildContext context, WidgetRef ref, CatalogItemEntity? item) {
  showFormBottomSheet(
    context: context,
    title: item == null ? 'Add Catalog Item' : 'Edit Catalog Item',
    child: _CatalogEditor(item: item),
  );
}

class _CatalogEditor extends ConsumerStatefulWidget {
  const _CatalogEditor({this.item});
  final CatalogItemEntity? item;

  @override
  ConsumerState<_CatalogEditor> createState() => _CatalogEditorState();
}

class _CatalogEditorState extends ConsumerState<_CatalogEditor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _desc;
  late final TextEditingController _section;
  late CatalogItemType _type;
  late String _uom;
  late bool _active;
  late List<_VariantRow> _variants;
  bool _saving = false;

  static const _uomOptions = ['Sq.Ft', 'Point', 'No', 'Rft'];

  @override
  void initState() {
    super.initState();
    final it = widget.item;
    _name = TextEditingController(text: it?.name ?? '');
    _desc = TextEditingController(text: it?.description ?? '');
    _section = TextEditingController(text: it?.defaultSection ?? '');
    _type = it?.itemType ?? CatalogItemType.component;
    _uom = it?.uom.isNotEmpty == true ? it!.uom : 'Sq.Ft';
    _active = it?.active ?? true;
    _variants = (it?.variants.isNotEmpty == true)
        ? it!.variants.map((v) => _VariantRow.from(v)).toList()
        : [_VariantRow.empty()];
  }

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _section.dispose();
    for (final v in _variants) {
      v.dispose();
    }
    super.dispose();
  }

  String get _rateHint => switch (_type) {
        CatalogItemType.component => 'Rate ₹/sq.ft',
        CatalogItemType.accessory => 'Unit price ₹',
        CatalogItemType.service => 'Rate ₹/$_uom',
      };

  String get _variantHint => _type == CatalogItemType.accessory
      ? 'Brand / variant (e.g. Hettich)'
      : 'Variant (e.g. Carcass • Premium)';

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final variants = _variants
        .where((v) => v.label.text.trim().isNotEmpty)
        .map((v) => CatalogVariant(
              label: v.label.text.trim(),
              rate: double.tryParse(v.rate.text) ?? 0,
            ))
        .toList();
    if (variants.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one variant with a rate')),
      );
      return;
    }
    setState(() => _saving = true);
    final entity = CatalogItemEntity(
      id: widget.item?.id ?? '',
      name: _name.text.trim(),
      description: _desc.text.trim(),
      itemType: _type,
      uom: _type == CatalogItemType.service ? _uom : '',
      defaultSection: _section.text.trim(),
      variants: variants,
      active: _active,
    );
    final ctrl = ref.read(quotationControllerProvider.notifier);
    final ok = widget.item == null
        ? await ctrl.addCatalogItem(entity)
        : await ctrl.updateCatalogItem(entity);
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) {
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(
                labelText: 'Item name', border: OutlineInputBorder(), isDense: true),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _desc,
            maxLines: 2,
            decoration: const InputDecoration(
                labelText: 'Description (optional)',
                border: OutlineInputBorder(),
                isDense: true),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<CatalogItemType>(
            initialValue: _type,
            decoration: const InputDecoration(
                labelText: 'Type', border: OutlineInputBorder(), isDense: true),
            items: CatalogItemType.values
                .map((t) => DropdownMenuItem(
                    value: t,
                    child: Text(
                        '${t.label} • ${switch (t) {
                      CatalogItemType.component => 'area × rate',
                      CatalogItemType.accessory => 'qty × price',
                      CatalogItemType.service => 'qty × rate/UOM',
                    }}')))
                .toList(),
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          if (_type == CatalogItemType.service) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _uom,
              decoration: const InputDecoration(
                  labelText: 'Unit of measure',
                  border: OutlineInputBorder(),
                  isDense: true),
              items: _uomOptions
                  .map((u) => DropdownMenuItem(value: u, child: Text(u)))
                  .toList(),
              onChanged: (v) => setState(() => _uom = v ?? _uom),
            ),
          ],
          const SizedBox(height: 12),
          TextFormField(
            controller: _section,
            decoration: const InputDecoration(
                labelText: 'Default section (e.g. Modular Kitchen)',
                border: OutlineInputBorder(),
                isDense: true),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Variants & rates',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              TextButton.icon(
                onPressed: () =>
                    setState(() => _variants.add(_VariantRow.empty())),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add'),
              ),
            ],
          ),
          ..._variants.asMap().entries.map((e) {
            final i = e.key;
            final row = e.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      controller: row.label,
                      decoration: InputDecoration(
                          labelText: _variantHint,
                          border: const OutlineInputBorder(),
                          isDense: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: row.rate,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                      ],
                      decoration: InputDecoration(
                          labelText: _rateHint,
                          border: const OutlineInputBorder(),
                          isDense: true),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline),
                    onPressed: _variants.length > 1
                        ? () => setState(() {
                              _variants.removeAt(i).dispose();
                            })
                        : null,
                  ),
                ],
              ),
            );
          }),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Active'),
            subtitle: const Text('Available when building quotes'),
            value: _active,
            onChanged: (v) => setState(() => _active = v),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save),
            label: Text(_saving ? 'Saving…' : 'Save Item'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _VariantRow {
  _VariantRow(this.label, this.rate);
  factory _VariantRow.empty() =>
      _VariantRow(TextEditingController(), TextEditingController());
  factory _VariantRow.from(CatalogVariant v) => _VariantRow(
        TextEditingController(text: v.label),
        TextEditingController(text: v.rate.toStringAsFixed(0)),
      );
  final TextEditingController label;
  final TextEditingController rate;
  void dispose() {
    label.dispose();
    rate.dispose();
  }
}
