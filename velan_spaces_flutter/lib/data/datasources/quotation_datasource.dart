import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/models/catalog_item_model.dart';
import 'package:velan_spaces_flutter/data/models/quotation_settings_model.dart';
import 'package:velan_spaces_flutter/data/models/quote_model.dart';

const String _orgSettingsCollection = 'orgSettings';
const String _quotationSettingsDoc = 'quotation';
const String _catalogCollection = 'catalogItems';
const String _leadsCollection = 'leads';
const String _quotesSubcollection = 'quotes';

/// Firestore access for the quotation feature: admin settings, the rate-card
/// catalog, and per-lead quotes.
class QuotationDatasource {
  final FirebaseFirestore _firestore;

  QuotationDatasource(this._firestore);

  // ── Settings (single doc orgSettings/quotation) ───────────────────────
  Stream<QuotationSettingsModel?> watchSettings() {
    return _firestore
        .collection(_orgSettingsCollection)
        .doc(_quotationSettingsDoc)
        .snapshots()
        .map((snap) => snap.exists ? QuotationSettingsModel.fromSnapshot(snap) : null);
  }

  Future<QuotationSettingsModel?> getSettings() async {
    final snap = await _firestore
        .collection(_orgSettingsCollection)
        .doc(_quotationSettingsDoc)
        .get();
    return snap.exists ? QuotationSettingsModel.fromSnapshot(snap) : null;
  }

  Future<void> saveSettings(QuotationSettingsModel settings) async {
    await _firestore
        .collection(_orgSettingsCollection)
        .doc(_quotationSettingsDoc)
        .set(settings.toJson(), SetOptions(merge: true));
  }

  // ── Catalog / rate card ───────────────────────────────────────────────
  Stream<List<CatalogItemModel>> watchCatalog() {
    return _firestore
        .collection(_catalogCollection)
        .orderBy('name')
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => CatalogItemModel.fromSnapshot(d)).toList());
  }

  Future<String> addCatalogItem(CatalogItemModel item) async {
    final ref = await _firestore.collection(_catalogCollection).add({
      ...item.toJson(),
      'createdAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  Future<void> updateCatalogItem(String id, CatalogItemModel item) async {
    await _firestore.collection(_catalogCollection).doc(id).update(item.toJson());
  }

  Future<void> deleteCatalogItem(String id) async {
    await _firestore.collection(_catalogCollection).doc(id).delete();
  }

  // ── Quotes (leads/{leadId}/quotes) ────────────────────────────────────
  CollectionReference<Map<String, dynamic>> _quotesCol(String leadId) =>
      _firestore.collection(_leadsCollection).doc(leadId).collection(_quotesSubcollection);

  Stream<List<QuoteModel>> watchQuotes(String leadId) {
    return _quotesCol(leadId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snap) => snap.docs.map((d) => QuoteModel.fromSnapshot(d)).toList());
  }

  Future<String> addQuote(String leadId, QuoteModel quote) async {
    final ref = await _quotesCol(leadId).add({
      ...quote.toJson(),
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  Future<void> updateQuote(String leadId, String quoteId, QuoteModel quote) async {
    await _quotesCol(leadId).doc(quoteId).update({
      ...quote.toJson(),
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteQuote(String leadId, String quoteId) async {
    await _quotesCol(leadId).doc(quoteId).delete();
  }

  /// Sequential quote number per year, e.g. "QUO-2026-007", using a counter doc
  /// at orgSettings/quotation/counters/{year} in a transaction.
  Future<String> nextQuoteNumber(String prefix, int year) async {
    final counterRef = _firestore
        .collection(_orgSettingsCollection)
        .doc(_quotationSettingsDoc)
        .collection('counters')
        .doc('$year');
    final seq = await _firestore.runTransaction<int>((txn) async {
      final snap = await txn.get(counterRef);
      final current = (snap.data()?['seq'] as num?)?.toInt() ?? 0;
      final next = current + 1;
      txn.set(counterRef, {'seq': next}, SetOptions(merge: true));
      return next;
    });
    return '$prefix$year-${seq.toString().padLeft(3, '0')}';
  }
}
