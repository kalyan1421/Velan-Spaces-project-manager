import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/models/catalog_item_model.dart';
import 'package:velan_spaces_flutter/data/models/quotation_settings_model.dart';
import 'package:velan_spaces_flutter/data/models/quote_model.dart';
import 'package:velan_spaces_flutter/data/models/quote_template_model.dart';

/// Topics for the quotation feature (see core/api/polling.dart).
class QuotationTopics {
  QuotationTopics._();
  static const settings = 'quotation:settings';
  static const catalog = 'quotation:catalog';
  static const templates = 'quotation:templates';
  static const quotes = 'quotation:quotes';
}

/// Quotation feature over the Velan API: settings, rate card, templates and
/// quotes. "watch" methods poll and refresh right after this app's own writes.
/// Quote numbers and totals are assigned/recomputed by the server.
class ApiQuotationDatasource {
  ApiQuotationDatasource(this._api);

  final ApiClient _api;

  List<Map<String, dynamic>> _list(dynamic json) =>
      (json as List? ?? const []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();

  void _changed(String topic) => ApiInvalidation.instance.notify(topic);

  // ── Settings ──────────────────────────────────────────────────────────
  Stream<QuotationSettingsModel?> watchSettings() => pollJson<QuotationSettingsModel?>(
        fetchJson: () => _api.get('/quotation-settings'),
        map: (json) => json is Map ? QuotationSettingsModel.fromJson(Map<String, dynamic>.from(json)) : null,
        topics: [QuotationTopics.settings],
      );

  Future<void> saveSettings(QuotationSettingsModel settings) async {
    await _api.put('/quotation-settings', settings.toJson());
    _changed(QuotationTopics.settings);
  }

  // ── Catalog / rate card ───────────────────────────────────────────────
  /// Includes inactive items (the admin list shows them; DELETE only
  /// deactivates, so a removed item stays listed as "Inactive").
  Stream<List<CatalogItemModel>> watchCatalog() => pollJson<List<CatalogItemModel>>(
        fetchJson: () => _api.get('/catalog-items', query: {'includeInactive': 'true'}),
        map: (json) => _list(json).map(CatalogItemModel.fromJson).toList(),
        topics: [QuotationTopics.catalog],
      );

  Future<String> addCatalogItem(CatalogItemModel item) async {
    final res = await _api.post('/catalog-items', item.toJson()) as Map<String, dynamic>;
    _changed(QuotationTopics.catalog);
    return res['id'] as String;
  }

  Future<void> updateCatalogItem(String id, CatalogItemModel item) async {
    await _api.patch('/catalog-items/$id', item.toJson());
    _changed(QuotationTopics.catalog);
  }

  Future<void> deleteCatalogItem(String id) async {
    await _api.delete('/catalog-items/$id');
    _changed(QuotationTopics.catalog);
  }

  // ── Templates ─────────────────────────────────────────────────────────
  Stream<List<QuoteTemplateModel>> watchTemplates() => pollJson<List<QuoteTemplateModel>>(
        fetchJson: () => _api.get('/quote-templates'),
        map: (json) => _list(json).map(QuoteTemplateModel.fromJson).toList(),
        topics: [QuotationTopics.templates],
      );

  Future<String> addTemplate(QuoteTemplateModel t) async {
    final res = await _api.post('/quote-templates', t.toJson()) as Map<String, dynamic>;
    _changed(QuotationTopics.templates);
    return res['id'] as String;
  }

  Future<void> updateTemplate(String id, QuoteTemplateModel t) async {
    await _api.patch('/quote-templates/$id', t.toJson());
    _changed(QuotationTopics.templates);
  }

  Future<void> deleteTemplate(String id) async {
    await _api.delete('/quote-templates/$id');
    _changed(QuotationTopics.templates);
  }

  // ── Quotes ────────────────────────────────────────────────────────────
  /// Newest first, for one lead.
  Stream<List<QuoteModel>> watchQuotes(String leadId) => pollJson<List<QuoteModel>>(
        fetchJson: () => _api.get('/quotes', query: {'leadId': leadId}),
        map: (json) => _list(json).map(QuoteModel.fromJson).toList(),
        topics: [QuotationTopics.quotes],
      );

  /// Returns the new quote (server-assigned id and number).
  Future<QuoteModel> addQuote(QuoteModel quote) async {
    final res = await _api.post('/quotes', quote.toJson()) as Map<String, dynamic>;
    _changed(QuotationTopics.quotes);
    return QuoteModel.fromJson(res);
  }

  /// Returns the saved quote (its `pdfUrl` comes back as a signed URL).
  Future<QuoteModel> updateQuote(String quoteId, QuoteModel quote) async {
    final res = await _api.patch('/quotes/$quoteId', quote.toJson()) as Map<String, dynamic>;
    _changed(QuotationTopics.quotes);
    return QuoteModel.fromJson(res);
  }

  Future<void> deleteQuote(String quoteId) async {
    await _api.delete('/quotes/$quoteId');
    _changed(QuotationTopics.quotes);
  }

  /// Copy as a new draft with a new number, dated today.
  Future<QuoteModel> duplicateQuote(String quoteId) async {
    final res = await _api.post('/quotes/$quoteId/duplicate') as Map<String, dynamic>;
    _changed(QuotationTopics.quotes);
    return QuoteModel.fromJson(res);
  }
}
