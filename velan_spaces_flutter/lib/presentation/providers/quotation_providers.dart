import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/services/media_compression_service.dart';
import 'package:velan_spaces_flutter/core/services/quotation_pdf_service.dart';
import 'package:velan_spaces_flutter/data/datasources/quotation_datasource.dart';
import 'package:velan_spaces_flutter/data/models/catalog_item_model.dart';
import 'package:velan_spaces_flutter/data/models/quotation_settings_model.dart';
import 'package:velan_spaces_flutter/data/models/quote_model.dart';
import 'package:velan_spaces_flutter/data/models/quote_template_model.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/design_document_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_template_entity.dart';
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

// ── Templates ───────────────────────────────────────────────────────────
final quoteTemplatesProvider = StreamProvider<List<QuoteTemplateEntity>>((ref) {
  return ref.watch(quotationDatasourceProvider).watchTemplates();
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
    state = const AsyncValue.loading();
    try {
      await _ds.deleteCatalogItem(id);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  // Templates
  Future<bool> addTemplate(QuoteTemplateEntity t) async {
    state = const AsyncValue.loading();
    try {
      await _ds.addTemplate(QuoteTemplateModel.fromEntity(t));
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> updateTemplate(QuoteTemplateEntity t) async {
    state = const AsyncValue.loading();
    try {
      await _ds.updateTemplate(t.id, QuoteTemplateModel.fromEntity(t));
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<bool> deleteTemplate(String id) async {
    state = const AsyncValue.loading();
    try {
      await _ds.deleteTemplate(id);
      state = const AsyncValue.data(null);
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
    state = const AsyncValue.loading();
    try {
      await _ds.deleteQuote(leadId, quoteId);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  Future<String> nextQuoteNumber(String prefix, int year) =>
      _ds.nextQuoteNumber(prefix, year);

  /// Attaches the quote's PDF to [projectId] as a client-visible document (it
  /// surfaces in the project's Designs tab, which clients can already open).
  /// Generates+uploads the PDF first if one isn't hosted yet.
  Future<bool> attachQuoteToProject(
      QuoteEntity quote, String projectId, QuotationSettingsEntity settings) async {
    state = const AsyncValue.loading();
    try {
      var url = quote.pdfUrl;
      if (url.isEmpty) {
        final bytes =
            await QuotationPdfService.build(quote: quote, settings: settings);
        final uploaded = await uploadPdfBytes(quote, bytes);
        if (uploaded == null) throw Exception('Upload failed');
        url = uploaded;
      }
      final repo = _ref.read(projectRepositoryProvider);
      final design = DesignDocumentEntity(
        id: '',
        title: 'Quotation ${quote.quoteNumber}',
        fileUrl: url,
        type: 'Quotation',
        approvalStatus: const DesignApprovalStatus(),
        postedBy: _ref.read(currentUserMetaProvider)['name'] as String? ?? '',
        timestamp: DateTime.now(),
        projectId: projectId,
      );
      final res = await repo.addDesign(projectId, design);
      state = const AsyncValue.data(null);
      return res.fold((_) => false, (_) => true);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Builds the quote PDF bytes (no upload). Useful for native share.
  Future<Uint8List> buildPdfBytes(
          QuoteEntity quote, QuotationSettingsEntity settings) =>
      QuotationPdfService.build(quote: quote, settings: settings);

  /// Uploads already-built PDF [bytes] to Storage and, for saved quotes, stores
  /// the download URL + marks the quote 'sent'. Returns the hosted URL.
  Future<String?> uploadPdfBytes(QuoteEntity quote, Uint8List bytes) async {
    try {
      final storage = _ref.read(storageDatasourceProvider);
      final name = (quote.quoteNumber.isEmpty ? 'quote' : quote.quoteNumber)
          .replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
      final url = await storage.uploadBytes(
        bytes,
        'quotation/sent',
        '$name.pdf',
        contentType: 'application/pdf',
      );
      if (quote.id.isNotEmpty) {
        final updated = quote.copyWith(
          pdfUrl: url,
          status: quote.status == 'draft' ? 'sent' : quote.status,
        );
        await _ds.updateQuote(
            quote.leadId, quote.id, QuoteModel.fromEntity(updated));
      }
      return url;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }
}
