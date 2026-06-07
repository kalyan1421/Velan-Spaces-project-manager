import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';

class QuoteModel extends QuoteEntity {
  const QuoteModel({
    required super.id,
    required super.leadId,
    super.quoteNumber,
    super.status,
    super.preparedForName,
    super.preparedForPhone,
    super.preparedForAddress,
    super.handledBy,
    super.designedBy,
    super.date,
    super.validUntil,
    super.enquiryDate,
    super.enquiryNo,
    super.siteLocation,
    super.projectType,
    super.notIncluded,
    super.sections,
    super.discountType,
    super.discountValue,
    super.gstPercent,
    super.subtotal,
    super.grandTotal,
    super.createdAt,
    super.updatedAt,
    super.createdBy,
  });

  // ── Item (de)serialization ────────────────────────────────────────────
  static Map<String, dynamic> _itemToJson(QuoteItem i) => {
        'catalogItemId': i.catalogItemId,
        'name': i.name,
        'description': i.description,
        'itemType': i.itemType.name,
        'variantLabel': i.variantLabel,
        'lengthMm': i.lengthMm,
        'heightMm': i.heightMm,
        'qty': i.qty,
        'uom': i.uom,
        'rate': i.rate,
        'amount': i.amount,
      };

  static QuoteItem _itemFromJson(Map<String, dynamic> j) => QuoteItem(
        catalogItemId: j['catalogItemId'] as String?,
        name: j['name'] ?? '',
        description: j['description'] ?? '',
        itemType: CatalogItemTypeX.fromName(j['itemType'] as String?),
        variantLabel: j['variantLabel'] ?? '',
        lengthMm: (j['lengthMm'] as num?)?.toDouble(),
        heightMm: (j['heightMm'] as num?)?.toDouble(),
        qty: (j['qty'] as num?)?.toDouble(),
        uom: j['uom'] ?? '',
        rate: (j['rate'] as num?)?.toDouble() ?? 0,
        amount: (j['amount'] as num?)?.toDouble() ?? 0,
      );

  static Map<String, dynamic> _sectionToJson(QuoteSection s) => {
        'title': s.title,
        'type': s.type.name,
        'items': s.items.map(_itemToJson).toList(),
      };

  static QuoteSection _sectionFromJson(Map<String, dynamic> j) => QuoteSection(
        title: j['title'] ?? '',
        type: CatalogItemTypeX.fromName(j['type'] as String?),
        items: ((j['items'] as List?) ?? [])
            .map((e) => _itemFromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );

  factory QuoteModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return QuoteModel(
      id: snap.id,
      leadId: data['leadId'] ?? '',
      quoteNumber: data['quoteNumber'] ?? '',
      status: data['status'] ?? 'draft',
      preparedForName: data['preparedForName'] ?? '',
      preparedForPhone: data['preparedForPhone'] ?? '',
      preparedForAddress: data['preparedForAddress'] ?? '',
      handledBy: data['handledBy'] ?? '',
      designedBy: data['designedBy'] ?? '',
      date: (data['date'] as Timestamp?)?.toDate(),
      validUntil: (data['validUntil'] as Timestamp?)?.toDate(),
      enquiryDate: (data['enquiryDate'] as Timestamp?)?.toDate(),
      enquiryNo: data['enquiryNo'] ?? '',
      siteLocation: data['siteLocation'] ?? '',
      projectType: data['projectType'] ?? 'Residential',
      notIncluded:
          ((data['notIncluded'] as List?) ?? []).map((e) => e.toString()).toList(),
      sections: ((data['sections'] as List?) ?? [])
          .map((e) => _sectionFromJson(Map<String, dynamic>.from(e)))
          .toList(),
      discountType: (data['discountType'] == 'percent')
          ? DiscountType.percent
          : DiscountType.flat,
      discountValue: (data['discountValue'] as num?)?.toDouble() ?? 0,
      gstPercent: (data['gstPercent'] as num?)?.toDouble() ?? 0,
      subtotal: (data['subtotal'] as num?)?.toDouble() ?? 0,
      grandTotal: (data['grandTotal'] as num?)?.toDouble() ?? 0,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
      createdBy: data['createdBy'] ?? '',
    );
  }

  factory QuoteModel.fromEntity(QuoteEntity e) => QuoteModel(
        id: e.id,
        leadId: e.leadId,
        quoteNumber: e.quoteNumber,
        status: e.status,
        preparedForName: e.preparedForName,
        preparedForPhone: e.preparedForPhone,
        preparedForAddress: e.preparedForAddress,
        handledBy: e.handledBy,
        designedBy: e.designedBy,
        date: e.date,
        validUntil: e.validUntil,
        enquiryDate: e.enquiryDate,
        enquiryNo: e.enquiryNo,
        siteLocation: e.siteLocation,
        projectType: e.projectType,
        notIncluded: e.notIncluded,
        sections: e.sections,
        discountType: e.discountType,
        discountValue: e.discountValue,
        gstPercent: e.gstPercent,
        subtotal: e.subtotal,
        grandTotal: e.grandTotal,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        createdBy: e.createdBy,
      );

  /// Firestore payload. Dates are written as Timestamps; server timestamps for
  /// createdAt/updatedAt are added by the datasource.
  Map<String, dynamic> toJson() => {
        'leadId': leadId,
        'quoteNumber': quoteNumber,
        'status': status,
        'preparedForName': preparedForName,
        'preparedForPhone': preparedForPhone,
        'preparedForAddress': preparedForAddress,
        'handledBy': handledBy,
        'designedBy': designedBy,
        'date': date != null ? Timestamp.fromDate(date!) : null,
        'validUntil': validUntil != null ? Timestamp.fromDate(validUntil!) : null,
        'enquiryDate': enquiryDate != null ? Timestamp.fromDate(enquiryDate!) : null,
        'enquiryNo': enquiryNo,
        'siteLocation': siteLocation,
        'projectType': projectType,
        'notIncluded': notIncluded,
        'sections': sections.map(_sectionToJson).toList(),
        'discountType': discountType.name,
        'discountValue': discountValue,
        'gstPercent': gstPercent,
        'subtotal': subtotal,
        'grandTotal': grandTotal,
        'createdBy': createdBy,
      };
}
