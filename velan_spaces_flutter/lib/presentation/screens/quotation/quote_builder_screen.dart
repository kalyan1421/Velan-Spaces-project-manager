import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/utils/bottom_sheet_utils.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/core/utils/quote_calculator.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/lead_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/lead_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';
import 'package:velan_spaces_flutter/presentation/screens/quotation/quote_preview_screen.dart';

/// Builds or edits a quote. Amounts auto-calculate from the rate card as items
/// are added; subtotal, discount, GST and grand total recompute live.
class QuoteBuilderScreen extends ConsumerStatefulWidget {
  const QuoteBuilderScreen({
    required this.leadId,
    this.existing,
    this.initialSections,
    super.key,
  });

  final String leadId;
  final QuoteEntity? existing;

  /// Pre-filled sections when starting a new quote from a template.
  final List<QuoteSection>? initialSections;

  @override
  ConsumerState<QuoteBuilderScreen> createState() => _QuoteBuilderScreenState();
}

class _QuoteBuilderScreenState extends ConsumerState<QuoteBuilderScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _handledBy = TextEditingController();
  final _designedBy = TextEditingController();
  final _siteLocation = TextEditingController();
  final _projectType = TextEditingController();
  final _enquiryNo = TextEditingController();
  final _discount = TextEditingController(text: '0');
  final _gst = TextEditingController(text: '0');

  DiscountType _discountType = DiscountType.flat;
  List<QuoteSection> _sections = [];
  String _quoteNumber = '';
  String _status = 'draft';
  DateTime _date = _today();
  DateTime? _validUntil;
  bool _round = true;

  bool _initialized = false;
  bool _saving = false;

  static DateTime _today() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  @override
  void dispose() {
    for (final c in [
      _name, _phone, _email, _address, _handledBy, _designedBy,
      _siteLocation, _projectType, _enquiryNo, _discount, _gst,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _initFrom(QuotationSettingsEntity settings, LeadEntity? lead) {
    final q = widget.existing;
    if (q != null) {
      _name.text = q.preparedForName;
      _phone.text = q.preparedForPhone;
      _email.text = q.preparedForEmail;
      _address.text = q.preparedForAddress;
      _handledBy.text = q.handledBy;
      _designedBy.text = q.designedBy;
      _siteLocation.text = q.siteLocation;
      _projectType.text = q.projectType;
      _enquiryNo.text = q.enquiryNo;
      _discount.text = q.discountValue.toStringAsFixed(0);
      _gst.text = q.gstPercent.toStringAsFixed(0);
      _discountType = q.discountType;
      _sections = q.sections;
      _quoteNumber = q.quoteNumber;
      _status = q.status;
      _date = q.date ?? _today();
      _validUntil = q.validUntil;
    } else {
      // New quote — prefill from lead + settings.
      _name.text = lead?.clientName ?? '';
      _phone.text = lead?.clientPhone ?? '';
      _siteLocation.text = lead?.area ?? '';
      _projectType.text =
          (lead?.projectType.isNotEmpty == true) ? lead!.projectType : settings.defaultProjectType;
      _gst.text = settings.defaultGstPercent.toStringAsFixed(0);
      _date = _today();
      _validUntil = _date.add(Duration(days: settings.quoteValidityDays));
      _sections = widget.initialSections ?? [];
    }
    _round = settings.roundAmounts;
    _initialized = true;
  }

  // ── Live totals ────────────────────────────────────────────────────────
  double get _subtotal => QuoteCalculator.subtotal(_sections);
  double get _grandTotal => QuoteCalculator.grandTotal(
        subtotal: _subtotal,
        discountType: _discountType,
        discountValue: double.tryParse(_discount.text) ?? 0,
        gstPercent: double.tryParse(_gst.text) ?? 0,
        round: _round,
      );

  // ── Section / item mutations ───────────────────────────────────────────
  void _addSection() async {
    final result = await showFormBottomSheet<_SectionDraft>(
      context: context,
      title: 'Add Section',
      initialSize: 0.5,
      child: const _SectionSheet(),
    );
    if (result != null) {
      setState(() => _sections = [
            ..._sections,
            QuoteSection(title: result.title, type: result.type, items: const []),
          ]);
    }
  }

  void _removeSection(int index) {
    setState(() => _sections = [..._sections]..removeAt(index));
  }

  Future<void> _addItem(int sectionIndex) async {
    final section = _sections[sectionIndex];
    final catalog = ref
        .read(activeCatalogProvider)
        .where((c) => c.itemType == section.type)
        .toList();
    if (catalog.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(
                'No active ${section.type.label.toLowerCase()} items in the rate card yet')),
      );
      return;
    }
    final item = await showFormBottomSheet<QuoteItem>(
      context: context,
      title: 'Add ${section.type.label}',
      child: _AddItemSheet(catalog: catalog, round: _round),
    );
    if (item != null) {
      final items = [...section.items, item];
      setState(() {
        _sections = [..._sections];
        _sections[sectionIndex] = section.copyWith(items: items);
      });
    }
  }

  void _removeItem(int sectionIndex, int itemIndex) {
    final section = _sections[sectionIndex];
    final items = [...section.items]..removeAt(itemIndex);
    setState(() {
      _sections = [..._sections];
      _sections[sectionIndex] = section.copyWith(items: items);
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────
  Future<void> _save(QuotationSettingsEntity settings) async {
    if (_name.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the client name (Prepared For)')),
      );
      return;
    }
    setState(() => _saving = true);
    final ctrl = ref.read(quotationControllerProvider.notifier);
    final meta = ref.read(currentUserMetaProvider);

    var number = _quoteNumber;
    if (number.isEmpty) {
      number = await ctrl.nextQuoteNumber(settings.quoteNumberPrefix, _date.year);
    }

    var quote = QuoteEntity(
      id: widget.existing?.id ?? '',
      leadId: widget.leadId,
      quoteNumber: number,
      status: _status,
      preparedForName: _name.text.trim(),
      preparedForPhone: _phone.text.trim(),
      preparedForEmail: _email.text.trim(),
      preparedForAddress: _address.text.trim(),
      pdfUrl: widget.existing?.pdfUrl ?? '',
      handledBy: _handledBy.text.trim(),
      designedBy: _designedBy.text.trim(),
      date: _date,
      validUntil: _validUntil,
      enquiryDate: widget.existing?.enquiryDate ?? _date,
      enquiryNo: _enquiryNo.text.trim(),
      siteLocation: _siteLocation.text.trim(),
      projectType: _projectType.text.trim(),
      notIncluded: widget.existing?.notIncluded ?? settings.defaultNotIncluded,
      sections: _sections,
      discountType: _discountType,
      discountValue: double.tryParse(_discount.text) ?? 0,
      gstPercent: double.tryParse(_gst.text) ?? 0,
      createdBy: meta['name'] as String? ?? '',
    );
    quote = QuoteCalculator.recomputeQuote(quote, round: _round);

    final ok = widget.existing == null
        ? (await ctrl.createQuote(quote)) != null
        : await ctrl.updateQuote(quote);

    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Quote $number saved')),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save quote')),
      );
    }
  }

  /// Assembles the current on-screen state into a quote (computed) for preview,
  /// without persisting or burning a quote number.
  QuoteEntity _currentQuote(QuotationSettingsEntity settings) {
    final quote = QuoteEntity(
      id: widget.existing?.id ?? '',
      leadId: widget.leadId,
      quoteNumber: _quoteNumber,
      status: _status,
      preparedForName: _name.text.trim(),
      preparedForPhone: _phone.text.trim(),
      preparedForEmail: _email.text.trim(),
      preparedForAddress: _address.text.trim(),
      pdfUrl: widget.existing?.pdfUrl ?? '',
      handledBy: _handledBy.text.trim(),
      designedBy: _designedBy.text.trim(),
      date: _date,
      validUntil: _validUntil,
      enquiryDate: widget.existing?.enquiryDate ?? _date,
      enquiryNo: _enquiryNo.text.trim(),
      siteLocation: _siteLocation.text.trim(),
      projectType: _projectType.text.trim(),
      notIncluded: widget.existing?.notIncluded ?? settings.defaultNotIncluded,
      sections: _sections,
      discountType: _discountType,
      discountValue: double.tryParse(_discount.text) ?? 0,
      gstPercent: double.tryParse(_gst.text) ?? 0,
    );
    return QuoteCalculator.recomputeQuote(quote, round: _round);
  }

  void _preview(QuotationSettingsEntity settings) {
    if (_sections.every((s) => s.items.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one item to preview')),
      );
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => QuotePreviewScreen(quote: _currentQuote(settings)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(quotationSettingsProvider);
    final leads = ref.watch(allLeadsProvider).valueOrNull ?? [];
    final lead = leads.where((l) => l.id == widget.leadId).cast<LeadEntity?>().firstOrNull;

    return settingsAsync.when(
      loading: () => const Scaffold(
          body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('Error: $e'))),
      data: (settings) {
        final s = settings ?? const QuotationSettingsEntity();
        if (!_initialized) _initFrom(s, lead);
        return Scaffold(
          appBar: AppBar(
            title: Text(_quoteNumber.isEmpty ? 'New Quote' : _quoteNumber),
            actions: [
              IconButton(
                icon: const Icon(Icons.picture_as_pdf_outlined),
                tooltip: 'Preview PDF',
                onPressed: () => _preview(s),
              ),
            ],
          ),
          bottomNavigationBar: _buildTotalsBar(context, s),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              _headerCard(),
              const SizedBox(height: 16),
              ..._sections.asMap().entries.map((e) => _sectionCard(e.key, e.value)),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _addSection,
                icon: const Icon(Icons.add),
                label: const Text('Add Section / Room'),
              ),
              const SizedBox(height: 16),
              _discountGstCard(),
            ],
          ),
        );
      },
    );
  }

  Widget _headerCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Prepared For',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _tf(_name, 'Client name'),
            Row(children: [
              Expanded(child: _tf(_phone, 'Phone (WhatsApp)', keyboard: TextInputType.phone)),
              const SizedBox(width: 12),
              Expanded(child: _tf(_email, 'Email', keyboard: TextInputType.emailAddress)),
            ]),
            _tf(_address, 'Address', maxLines: 2),
            const Divider(height: 24),
            Row(children: [
              Expanded(child: _tf(_handledBy, 'Handled by')),
              const SizedBox(width: 12),
              Expanded(child: _tf(_designedBy, 'Designed by')),
            ]),
            Row(children: [
              Expanded(child: _tf(_projectType, 'Project type')),
              const SizedBox(width: 12),
              Expanded(child: _tf(_enquiryNo, 'Enquiry no.')),
            ]),
            _tf(_siteLocation, 'Site location'),
            const SizedBox(height: 4),
            Row(
              children: [
                Expanded(
                  child: _dateTile('Date', _date, (d) => setState(() => _date = d)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _dateTile('Valid until', _validUntil,
                      (d) => setState(() => _validUntil = d)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionCard(int index, QuoteSection section) {
    final subtotal = QuoteCalculator.sectionSubtotal(section.items);
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
            if (section.items.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('No items yet',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
              )
            else
              ...section.items.asMap().entries.map((e) {
                final i = e.key;
                final item = e.value;
                final meta = item.pricingBasis == PricingBasis.area
                    ? item.sizeLabel
                    : '${item.qty?.toStringAsFixed(item.qty == item.qty?.roundToDouble() ? 0 : 2) ?? ''} ${item.uom}';
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(item.name,
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                  subtitle: Text(
                      [item.variantLabel, meta].where((x) => x.trim().isNotEmpty).join(' • '),
                      style: const TextStyle(fontSize: 12)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(FormatUtils.formatCurrency(item.amount),
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () => _removeItem(index, i),
                      ),
                    ],
                  ),
                );
              }),
            const Divider(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton.icon(
                  onPressed: () => _addItem(index),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text('Add ${section.type.label}'),
                ),
                Text('Subtotal: ${FormatUtils.formatCurrency(subtotal)}',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _discountGstCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Discount & Tax',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                SizedBox(
                  width: 130,
                  child: DropdownButtonFormField<DiscountType>(
                    initialValue: _discountType,
                    decoration: const InputDecoration(
                        labelText: 'Discount', border: OutlineInputBorder(), isDense: true),
                    items: const [
                      DropdownMenuItem(value: DiscountType.flat, child: Text('₹ Flat')),
                      DropdownMenuItem(
                          value: DiscountType.percent, child: Text('% Percent')),
                    ],
                    onChanged: (v) =>
                        setState(() => _discountType = v ?? _discountType),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _discount,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                    ],
                    decoration: const InputDecoration(
                        labelText: 'Value', border: OutlineInputBorder(), isDense: true),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _gst,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))
                    ],
                    decoration: const InputDecoration(
                        labelText: 'GST %', border: OutlineInputBorder(), isDense: true),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalsBar(BuildContext context, QuotationSettingsEntity settings) {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8),
          ],
        ),
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Subtotal ${FormatUtils.formatCurrency(_subtotal)}',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                Text(FormatUtils.formatCurrency(_grandTotal),
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                const Text('Grand Total', style: TextStyle(fontSize: 10)),
              ],
            ),
            const Spacer(),
            FilledButton.icon(
              onPressed: _saving ? null : () => _save(settings),
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save),
              label: Text(_saving ? 'Saving…' : 'Save Quote'),
            ),
          ],
        ),
      ),
    );
  }

  // ── small helpers ──────────────────────────────────────────────────────
  Widget _tf(TextEditingController c, String label,
      {int maxLines = 1, TextInputType? keyboard}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: c,
        maxLines: maxLines,
        keyboardType: keyboard,
        decoration: InputDecoration(
            labelText: label, border: const OutlineInputBorder(), isDense: true),
      ),
    );
  }

  Widget _dateTile(String label, DateTime? value, ValueChanged<DateTime> onPick) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? _today(),
          firstDate: DateTime(2020),
          lastDate: DateTime(2100),
        );
        if (picked != null) onPick(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(
            labelText: label, border: const OutlineInputBorder(), isDense: true),
        child: Text(value != null ? FormatUtils.formatDate(value) : 'Select'),
      ),
    );
  }
}

// ── Add-section sheet ──────────────────────────────────────────────────────
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
                labelText: 'Table type', border: OutlineInputBorder(), isDense: true),
            items: CatalogItemType.values
                .map((t) => DropdownMenuItem(value: t, child: Text(t.label)))
                .toList(),
            onChanged: (v) => setState(() => _type = v ?? _type),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {
              final title = _title.text.trim();
              if (title.isEmpty) return;
              Navigator.pop(context, _SectionDraft(title, _type));
            },
            child: const Text('Add Section'),
          ),
        ],
      ),
    );
  }
}

// ── Add-item sheet (auto-calc) ──────────────────────────────────────────────
class _AddItemSheet extends StatefulWidget {
  const _AddItemSheet({required this.catalog, required this.round});
  final List<CatalogItemEntity> catalog;
  final bool round;

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
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

  double get _amount {
    if (_item == null || _variant == null) return 0;
    return QuoteCalculator.lineAmount(
      basis: _item!.pricingBasis,
      lengthMm: double.tryParse(_length.text),
      heightMm: double.tryParse(_height.text),
      qty: double.tryParse(_qty.text),
      rate: _variant!.rate,
      round: widget.round,
    );
  }

  void _confirm() {
    if (_item == null || _variant == null) return;
    final basis = _item!.pricingBasis;
    final item = QuoteItem(
      catalogItemId: _item!.id,
      name: _item!.name,
      description: _item!.description,
      itemType: _item!.itemType,
      variantLabel: _variant!.label,
      lengthMm: basis == PricingBasis.area ? double.tryParse(_length.text) : null,
      heightMm: basis == PricingBasis.area ? double.tryParse(_height.text) : null,
      qty: basis == PricingBasis.area ? null : double.tryParse(_qty.text),
      uom: _item!.uom,
      rate: _variant!.rate,
      amount: _amount,
    );
    Navigator.pop(context, item);
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
            _variant = v != null && v.variants.isNotEmpty ? v.variants.first : null;
          }),
        ),
        if (_item != null) ...[
          const SizedBox(height: 12),
          const Text('Variant', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: _item!.variants
                .map((v) => ChoiceChip(
                      label: Text(
                          '${v.label} • ₹${v.rate.toStringAsFixed(0)}'),
                      selected: _variant == v,
                      onSelected: (_) => setState(() => _variant = v),
                    ))
                .toList(),
          ),
          const SizedBox(height: 16),
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
            _numField(_qty, basis == PricingBasis.uom
                ? 'Quantity (${_item!.uom})'
                : 'Quantity'),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (basis == PricingBasis.area)
                  Text(
                    '${QuoteCalculator.areaSqft(double.tryParse(_length.text) ?? 0, double.tryParse(_height.text) ?? 0).toStringAsFixed(2)} sq.ft × ₹${_variant?.rate.toStringAsFixed(0) ?? 0}',
                    style: const TextStyle(fontSize: 12),
                  )
                else
                  Text(
                    '${_qty.text} × ₹${_variant?.rate.toStringAsFixed(0) ?? 0}',
                    style: const TextStyle(fontSize: 12),
                  ),
                Text(FormatUtils.formatCurrency(_amount),
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: (_item != null && _variant != null && _amount > 0)
                ? _confirm
                : null,
            icon: const Icon(Icons.add),
            label: const Text('Add to Quote'),
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
      onChanged: (_) => setState(() {}),
    );
  }
}
