import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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
    super.preparedForEmail,
    super.preparedForAddress,
    super.pdfUrl,
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

  static double? _optDouble(dynamic v) => v == null || v == '' ? null : apiDouble(v);

  static QuoteItem _itemFromJson(Map<String, dynamic> j) => QuoteItem(
        catalogItemId: j['catalogItemId'] as String?,
        name: apiString(j['name']),
        description: apiString(j['description']),
        itemType: CatalogItemTypeX.fromName(j['itemType'] as String?),
        variantLabel: apiString(j['variantLabel']),
        lengthMm: _optDouble(j['lengthMm']),
        heightMm: _optDouble(j['heightMm']),
        qty: _optDouble(j['qty']),
        uom: apiString(j['uom']),
        rate: apiDouble(j['rate']),
        amount: apiDouble(j['amount']),
      );

  static Map<String, dynamic> _sectionToJson(QuoteSection s) => {
        'title': s.title,
        'type': s.type.name,
        'items': s.items.map(_itemToJson).toList(),
      };

  static QuoteSection _sectionFromJson(Map<String, dynamic> j) => QuoteSection(
        title: apiString(j['title']),
        type: CatalogItemTypeX.fromName(j['type'] as String?),
        items: ((j['items'] as List?) ?? [])
            .map((e) => _itemFromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );

  /// Parses a `quotes` API row (camelCase; `quoteDate` is the entity's `date`).
  factory QuoteModel.fromJson(Map<String, dynamic> data) {
    return QuoteModel(
      id: apiString(data['id']),
      leadId: apiString(data['leadId']),
      quoteNumber: apiString(data['quoteNumber']),
      status: apiString(data['status'], 'draft'),
      preparedForName: apiString(data['preparedForName']),
      preparedForPhone: apiString(data['preparedForPhone']),
      preparedForEmail: apiString(data['preparedForEmail']),
      preparedForAddress: apiString(data['preparedForAddress']),
      pdfUrl: apiString(data['pdfUrl']),
      handledBy: apiString(data['handledBy']),
      designedBy: apiString(data['designedBy']),
      date: apiDate(data['quoteDate']),
      validUntil: apiDate(data['validUntil']),
      enquiryDate: apiDate(data['enquiryDate']),
      enquiryNo: apiString(data['enquiryNo']),
      siteLocation: apiString(data['siteLocation']),
      projectType: apiString(data['projectType'], 'Residential'),
      notIncluded: apiStringList(data['notIncluded']),
      sections: ((data['sections'] as List?) ?? [])
          .map((e) => _sectionFromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      discountType: (data['discountType'] == 'percent')
          ? DiscountType.percent
          : DiscountType.flat,
      discountValue: apiDouble(data['discountValue']),
      gstPercent: apiDouble(data['gstPercent']),
      subtotal: apiDouble(data['subtotal']),
      grandTotal: apiDouble(data['grandTotal']),
      createdAt: apiDate(data['createdAt']),
      updatedAt: apiDate(data['updatedAt']),
    );
  }

  factory QuoteModel.fromEntity(QuoteEntity e) => QuoteModel(
        id: e.id,
        leadId: e.leadId,
        quoteNumber: e.quoteNumber,
        status: e.status,
        preparedForName: e.preparedForName,
        preparedForPhone: e.preparedForPhone,
        preparedForEmail: e.preparedForEmail,
        preparedForAddress: e.preparedForAddress,
        pdfUrl: e.pdfUrl,
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

  /// POST/PATCH /quotes body. The server assigns the quote number and
  /// recomputes subtotal/grandTotal from the sections, so they are not sent.
  Map<String, dynamic> toJson() => {
        'leadId': leadId.isEmpty ? null : leadId,
        'status': status,
        'preparedForName': preparedForName,
        'preparedForPhone': preparedForPhone,
        'preparedForEmail': preparedForEmail,
        'preparedForAddress': preparedForAddress,
        'pdfUrl': pdfUrl,
        'handledBy': handledBy,
        'designedBy': designedBy,
        'quoteDate': apiTimestamp(date),
        'validUntil': apiTimestamp(validUntil),
        'enquiryDate': apiTimestamp(enquiryDate),
        'enquiryNo': enquiryNo,
        'siteLocation': siteLocation,
        'projectType': projectType,
        'notIncluded': notIncluded,
        'sections': sections.map(_sectionToJson).toList(),
        'discountType': discountType == DiscountType.percent ? 'percent' : 'amount',
        'discountValue': discountValue,
        'gstPercent': gstPercent,
      };
}
