import 'package:flutter/foundation.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';

enum DiscountType { flat, percent }

/// One priced line in a quote. [amount] is a computed snapshot (kept in sync by
/// the builder via QuoteCalculator) so the PDF and Firestore agree without
/// recomputation.
@immutable
class QuoteItem {
  const QuoteItem({
    this.catalogItemId,
    required this.name,
    this.description = '',
    this.itemType = CatalogItemType.component,
    this.variantLabel = '',
    this.lengthMm,
    this.heightMm,
    this.qty,
    this.uom = '',
    this.rate = 0,
    this.amount = 0,
  });

  final String? catalogItemId;
  final String name;
  final String description;
  final CatalogItemType itemType;
  final String variantLabel; // e.g. "Carcass • Premium" or brand "Hettich"
  final double? lengthMm; // area basis
  final double? heightMm; // area basis
  final double? qty; // qty / uom basis
  final String uom; // service UOM label
  final double rate;
  final double amount;

  PricingBasis get pricingBasis => itemType.pricingBasis;

  /// "5044(L) × 900(H)" for area items; "" otherwise.
  String get sizeLabel => (lengthMm != null && heightMm != null)
      ? '${lengthMm!.toInt()}(L) × ${heightMm!.toInt()}(H)'
      : '';

  QuoteItem copyWith({
    String? catalogItemId,
    String? name,
    String? description,
    CatalogItemType? itemType,
    String? variantLabel,
    double? lengthMm,
    double? heightMm,
    double? qty,
    String? uom,
    double? rate,
    double? amount,
  }) {
    return QuoteItem(
      catalogItemId: catalogItemId ?? this.catalogItemId,
      name: name ?? this.name,
      description: description ?? this.description,
      itemType: itemType ?? this.itemType,
      variantLabel: variantLabel ?? this.variantLabel,
      lengthMm: lengthMm ?? this.lengthMm,
      heightMm: heightMm ?? this.heightMm,
      qty: qty ?? this.qty,
      uom: uom ?? this.uom,
      rate: rate ?? this.rate,
      amount: amount ?? this.amount,
    );
  }
}

/// A room/area grouping of line items (e.g. "Modular Kitchen"). [type] drives
/// the column layout in the PDF table.
@immutable
class QuoteSection {
  const QuoteSection({
    required this.title,
    this.type = CatalogItemType.component,
    this.items = const [],
  });

  final String title;
  final CatalogItemType type;
  final List<QuoteItem> items;

  QuoteSection copyWith({
    String? title,
    CatalogItemType? type,
    List<QuoteItem>? items,
  }) {
    return QuoteSection(
      title: title ?? this.title,
      type: type ?? this.type,
      items: items ?? this.items,
    );
  }
}

/// A full quotation tied to a lead/enquiry. [subtotal]/[grandTotal] are computed
/// snapshots maintained by the builder.
@immutable
class QuoteEntity {
  const QuoteEntity({
    required this.id,
    required this.leadId,
    this.quoteNumber = '',
    this.status = 'draft', // draft | sent | accepted | rejected
    this.preparedForName = '',
    this.preparedForPhone = '',
    this.preparedForAddress = '',
    this.handledBy = '',
    this.designedBy = '',
    this.date,
    this.validUntil,
    this.enquiryDate,
    this.enquiryNo = '',
    this.siteLocation = '',
    this.projectType = 'Residential',
    this.notIncluded = const [],
    this.sections = const [],
    this.discountType = DiscountType.flat,
    this.discountValue = 0,
    this.gstPercent = 0,
    this.subtotal = 0,
    this.grandTotal = 0,
    this.createdAt,
    this.updatedAt,
    this.createdBy = '',
  });

  final String id;
  final String leadId;
  final String quoteNumber;
  final String status;
  final String preparedForName;
  final String preparedForPhone;
  final String preparedForAddress;
  final String handledBy;
  final String designedBy;
  final DateTime? date;
  final DateTime? validUntil;
  final DateTime? enquiryDate;
  final String enquiryNo;
  final String siteLocation;
  final String projectType;
  final List<String> notIncluded;
  final List<QuoteSection> sections;
  final DiscountType discountType;
  final double discountValue;
  final double gstPercent;
  final double subtotal;
  final double grandTotal;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String createdBy;

  QuoteEntity copyWith({
    String? id,
    String? leadId,
    String? quoteNumber,
    String? status,
    String? preparedForName,
    String? preparedForPhone,
    String? preparedForAddress,
    String? handledBy,
    String? designedBy,
    DateTime? date,
    DateTime? validUntil,
    DateTime? enquiryDate,
    String? enquiryNo,
    String? siteLocation,
    String? projectType,
    List<String>? notIncluded,
    List<QuoteSection>? sections,
    DiscountType? discountType,
    double? discountValue,
    double? gstPercent,
    double? subtotal,
    double? grandTotal,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? createdBy,
  }) {
    return QuoteEntity(
      id: id ?? this.id,
      leadId: leadId ?? this.leadId,
      quoteNumber: quoteNumber ?? this.quoteNumber,
      status: status ?? this.status,
      preparedForName: preparedForName ?? this.preparedForName,
      preparedForPhone: preparedForPhone ?? this.preparedForPhone,
      preparedForAddress: preparedForAddress ?? this.preparedForAddress,
      handledBy: handledBy ?? this.handledBy,
      designedBy: designedBy ?? this.designedBy,
      date: date ?? this.date,
      validUntil: validUntil ?? this.validUntil,
      enquiryDate: enquiryDate ?? this.enquiryDate,
      enquiryNo: enquiryNo ?? this.enquiryNo,
      siteLocation: siteLocation ?? this.siteLocation,
      projectType: projectType ?? this.projectType,
      notIncluded: notIncluded ?? this.notIncluded,
      sections: sections ?? this.sections,
      discountType: discountType ?? this.discountType,
      discountValue: discountValue ?? this.discountValue,
      gstPercent: gstPercent ?? this.gstPercent,
      subtotal: subtotal ?? this.subtotal,
      grandTotal: grandTotal ?? this.grandTotal,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      createdBy: createdBy ?? this.createdBy,
    );
  }
}
