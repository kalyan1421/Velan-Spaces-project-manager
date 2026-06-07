import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/quotation_providers.dart';

/// Admin-only screen to configure quotation defaults: company profile, branding
/// images (logo / watermark / cover), terms, not-included list, validity, tax.
class QuotationSettingsScreen extends ConsumerStatefulWidget {
  const QuotationSettingsScreen({super.key});

  @override
  ConsumerState<QuotationSettingsScreen> createState() =>
      _QuotationSettingsScreenState();
}

class _QuotationSettingsScreenState
    extends ConsumerState<QuotationSettingsScreen> {
  final _formKey = GlobalKey<FormState>();

  final _company = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _footer = TextEditingController();
  final _terms = TextEditingController();
  final _validity = TextEditingController(text: '15');
  final _prefix = TextEditingController(text: 'QUO-');
  final _projectType = TextEditingController(text: 'Residential');
  final _gst = TextEditingController(text: '0');
  final _notIncludedInput = TextEditingController();

  String _logoUrl = '';
  String _watermarkUrl = '';
  String _coverUrl = '';
  List<String> _notIncluded = [];
  bool _round = true;

  bool _loaded = false;
  bool _saving = false;
  String? _uploadingKey;

  @override
  void dispose() {
    for (final c in [
      _company, _phone, _email, _address, _footer, _terms,
      _validity, _prefix, _projectType, _gst, _notIncludedInput,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _hydrate(QuotationSettingsEntity s) {
    _company.text = s.companyName;
    _phone.text = s.phone;
    _email.text = s.email;
    _address.text = s.address;
    _footer.text = s.footerText;
    _terms.text = s.defaultTerms;
    _validity.text = s.quoteValidityDays.toString();
    _prefix.text = s.quoteNumberPrefix;
    _projectType.text = s.defaultProjectType;
    _gst.text = s.defaultGstPercent.toString();
    _logoUrl = s.logoUrl;
    _watermarkUrl = s.watermarkLogoUrl;
    _coverUrl = s.coverImageUrl;
    _notIncluded = List<String>.from(s.defaultNotIncluded);
    _round = s.roundAmounts;
    _loaded = true;
  }

  Future<void> _pickImage(String key) async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null) return;
    setState(() => _uploadingKey = key);
    final url = await ref
        .read(quotationControllerProvider.notifier)
        .uploadBrandingImage(file.path);
    if (!mounted) return;
    setState(() {
      if (url != null) {
        if (key == 'logo') _logoUrl = url;
        if (key == 'watermark') _watermarkUrl = url;
        if (key == 'cover') _coverUrl = url;
      }
      _uploadingKey = null;
    });
    if (url == null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload failed, try again')),
      );
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final settings = QuotationSettingsEntity(
      companyName: _company.text.trim(),
      phone: _phone.text.trim(),
      email: _email.text.trim(),
      address: _address.text.trim(),
      logoUrl: _logoUrl,
      watermarkLogoUrl: _watermarkUrl,
      coverImageUrl: _coverUrl,
      footerText: _footer.text.trim(),
      defaultTerms: _terms.text.trim(),
      defaultNotIncluded: _notIncluded,
      quoteValidityDays: int.tryParse(_validity.text) ?? 15,
      quoteNumberPrefix: _prefix.text.trim().isEmpty ? 'QUO-' : _prefix.text.trim(),
      defaultProjectType: _projectType.text.trim(),
      defaultGstPercent: double.tryParse(_gst.text) ?? 0,
      roundAmounts: _round,
    );
    final ok =
        await ref.read(quotationControllerProvider.notifier).saveSettings(settings);
    if (!mounted) return;
    setState(() => _saving = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ok ? 'Settings saved' : 'Failed to save')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(quotationSettingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Quotation Settings')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (settings) {
          if (!_loaded) _hydrate(settings ?? const QuotationSettingsEntity());
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _sectionTitle('Company Profile'),
                _field(_company, 'Company name', required: true),
                _field(_phone, 'Phone', keyboard: TextInputType.phone),
                _field(_email, 'Email', keyboard: TextInputType.emailAddress),
                _field(_address, 'Address', maxLines: 2),
                _field(_footer, 'Footer line (shown on every page)'),

                const SizedBox(height: 8),
                _sectionTitle('Branding'),
                _imageRow('Header logo', _logoUrl, 'logo'),
                _imageRow('Watermark logo', _watermarkUrl, 'watermark'),
                _imageRow('Cover page image', _coverUrl, 'cover', wide: true),

                const SizedBox(height: 8),
                _sectionTitle('Defaults'),
                Row(
                  children: [
                    Expanded(
                      child: _field(_prefix, 'Quote no. prefix'),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _field(_validity, 'Valid for (days)',
                          keyboard: TextInputType.number,
                          formatters: [FilteringTextInputFormatter.digitsOnly]),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Expanded(child: _field(_projectType, 'Project type')),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _field(_gst, 'Default GST %',
                          keyboard: const TextInputType.numberWithOptions(decimal: true)),
                    ),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Round amounts to whole ₹'),
                  value: _round,
                  onChanged: (v) => setState(() => _round = v),
                ),

                const SizedBox(height: 8),
                _sectionTitle('Default "Not Included" items'),
                _notIncludedEditor(),

                const SizedBox(height: 8),
                _sectionTitle('Default Terms & Conditions'),
                _field(_terms, 'Terms', maxLines: 5),

                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.save),
                  label: Text(_saving ? 'Saving…' : 'Save Settings'),
                ),
                const SizedBox(height: 32),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 8),
        child: Text(t,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      );

  Widget _field(
    TextEditingController c,
    String label, {
    bool required = false,
    int maxLines = 1,
    TextInputType? keyboard,
    List<TextInputFormatter>? formatters,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        maxLines: maxLines,
        keyboardType: keyboard,
        inputFormatters: formatters,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        validator: required
            ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
            : null,
      ),
    );
  }

  Widget _imageRow(String label, String url, String key, {bool wide = false}) {
    final uploading = _uploadingKey == key;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: wide ? 80 : 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade300),
              image: url.isNotEmpty
                  ? DecorationImage(image: NetworkImage(url), fit: BoxFit.cover)
                  : null,
            ),
            child: url.isEmpty
                ? Icon(Icons.image_outlined, color: Colors.grey.shade400)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
          uploading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : TextButton.icon(
                  onPressed: () => _pickImage(key),
                  icon: const Icon(Icons.upload, size: 18),
                  label: Text(url.isEmpty ? 'Upload' : 'Change'),
                ),
        ],
      ),
    );
  }

  Widget _notIncludedEditor() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: _notIncluded
              .map((e) => Chip(
                    label: Text(e),
                    onDeleted: () => setState(() => _notIncluded.remove(e)),
                  ))
              .toList(),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _notIncludedInput,
                decoration: const InputDecoration(
                  hintText: 'Add an item, e.g. "Loose Furniture"',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onSubmitted: (v) {
                  if (v.trim().isNotEmpty) {
                    setState(() => _notIncluded.add(v.trim()));
                    _notIncludedInput.clear();
                  }
                },
              ),
            ),
            IconButton(
              icon: const Icon(Icons.add_circle),
              onPressed: () {
                if (_notIncludedInput.text.trim().isNotEmpty) {
                  setState(() => _notIncluded.add(_notIncludedInput.text.trim()));
                  _notIncludedInput.clear();
                }
              },
            ),
          ],
        ),
      ],
    );
  }
}
