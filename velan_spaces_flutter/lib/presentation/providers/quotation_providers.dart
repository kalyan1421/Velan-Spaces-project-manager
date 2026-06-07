import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/services/media_compression_service.dart';
import 'package:velan_spaces_flutter/data/datasources/quotation_datasource.dart';
import 'package:velan_spaces_flutter/data/models/catalog_item_model.dart';
import 'package:velan_spaces_flutter/data/models/quotation_settings_model.dart';
import 'package:velan_spaces_flutter/data/models/quote_model.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';
import 'package:velan_spaces_flutter/presentation/providers/project_providers.dart';

// ── Datasource ──────────────────────────────────────────────────────────
final quotationDatasourceProvider = Provider<QuotationDatasource>((ref) {
  return QuotationDatasource(ref.watch(firestoreProvider));
});

// ── Settings ────────────────────────────────────────────────────────────
final quotationSettingsProvider =
    StreamProvider<QuotationSettingsEntity?>((ref) {
  return ref.watch(quotationDatasourceProvider).watchSettings();
});

// ── Catalog / rate card ─────────────────────────────────────────────────
final catalogProvider = StreamProvider<List<CatalogItemEntity>>((ref) {
  return ref.watch(quotationDatasourceProvider).watchCatalog();
});

/// Only active catalog items, used by the quote builder picker.
final activeCatalogProvider = Provider<List<CatalogItemEntity>>((ref) {
  return ref.watch(catalogProvider).valueOrNull?.where((c) => c.active).toList() ?? [];
});

// ── Quotes per lead ─────────────────────────────────────────────────────
final leadQuotesProvider =
    StreamProvider.family<List<QuoteEntity>, String>((ref, leadId) {
  return ref.watch(quotationDatasourceProvider).watchQuotes(leadId);
});

// ── Controller ──────────────────────────────────────────────────────────
final quotationControllerProvider =
    StateNotifierProvider<QuotationController, AsyncValue<void>>((ref) {
  return QuotationController(ref);
});

class QuotationController extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  QuotationController(this._ref) : super(const AsyncValue.data(null));

  QuotationDatasource get _ds => _ref.read(quotationDatasourceProvider);

  // Settings
  Future<bool> saveSettings(QuotationSettingsEntity settings) async {
    state = const AsyncValue.loading();
    try {
      await _ds.saveSettings(QuotationSettingsModel.fromEntity(settings));
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Compresses + uploads a branding image, returning its download URL.
  Future<String?> uploadBrandingImage(String filePath) async {
    try {
      final storage = _ref.read(storageDatasourceProvider);
      final compressed = await MediaCompressionService.compressImage(filePath);
      return await storage.uploadFile(compressed, 'quotation/branding');
    } catch (_) {
      return null;
    }
  }

  // Catalog
  Future<bool> addCatalogItem(CatalogItemEntity item) async {
    state = const AsyncValue.loading();
    try {
      await _ds.addCatalogItem(CatalogItemModel.fromEntity(item));
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateCatalogItem(CatalogItemEntity item) async {
    state = const AsyncValue.loading();
    try {
      await _ds.updateCatalogItem(item.id, CatalogItemModel.fromEntity(item));
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> deleteCatalogItem(String id) async {
    try {
      await _ds.deleteCatalogItem(id);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  // Quotes
  Future<String?> createQuote(QuoteEntity quote) async {
    state = const AsyncValue.loading();
    try {
      final id = await _ds.addQuote(quote.leadId, QuoteModel.fromEntity(quote));
      state = const AsyncValue.data(null);
      return id;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }

  Future<bool> updateQuote(QuoteEntity quote) async {
    state = const AsyncValue.loading();
    try {
      await _ds.updateQuote(
          quote.leadId, quote.id, QuoteModel.fromEntity(quote));
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> deleteQuote(String leadId, String quoteId) async {
    try {
      await _ds.deleteQuote(leadId, quoteId);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<String> nextQuoteNumber(String prefix, int year) =>
      _ds.nextQuoteNumber(prefix, year);
}
