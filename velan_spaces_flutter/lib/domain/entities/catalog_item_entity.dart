import 'package:flutter/foundation.dart';

/// What kind of catalog line this is — drives the columns shown in the
/// quote/PDF and the pricing formula.
enum CatalogItemType { component, accessory, service }

/// How an item's amount is derived from its inputs.
/// - [area]: amount = (L×H in sq.ft) × rate          (modular components)
/// - [qty] : amount = qty × unit price                (accessories)
/// - [uom] : amount = qty × rate per UOM              (services)
enum PricingBasis { area, qty, uom }

extension CatalogItemTypeX on CatalogItemType {
  String get label => switch (this) {
        CatalogItemType.component => 'Component',
        CatalogItemType.accessory => 'Accessory',
        CatalogItemType.service => 'Service',
      };

  /// The pricing basis implied by this item type (decisions: "Area/qty/UOM by type").
  PricingBasis get pricingBasis => switch (this) {
        CatalogItemType.component => PricingBasis.area,
        CatalogItemType.accessory => PricingBasis.qty,
        CatalogItemType.service => PricingBasis.uom,
      };

  static CatalogItemType fromName(String? name) => CatalogItemType.values
      .firstWhere((t) => t.name == name, orElse: () => CatalogItemType.component);
}

/// A priced option for a catalog item. For components/services [rate] is the
/// per-sq.ft / per-UOM rate; for accessories it is the per-unit price.
/// [label] is the displayed variant, e.g. "Carcass • Premium" or a brand "Hettich".
@immutable
class CatalogVariant {
  const CatalogVariant({required this.label, required this.rate});

  final String label;
  final double rate;

  Map<String, dynamic> toJson() => {'label': label, 'rate': rate};

  factory CatalogVariant.fromJson(Map<String, dynamic> json) => CatalogVariant(
        label: json['label'] as String? ?? '',
        rate: (json['rate'] as num?)?.toDouble() ?? 0,
      );

  CatalogVariant copyWith({String? label, double? rate}) =>
      CatalogVariant(label: label ?? this.label, rate: rate ?? this.rate);
}

/// A single entry in the admin-maintained rate card.
@immutable
class CatalogItemEntity {
  const CatalogItemEntity({
    required this.id,
    required this.name,
    this.description = '',
    this.itemType = CatalogItemType.component,
    this.uom = '',
    this.defaultSection = '',
    this.variants = const [],
    this.active = true,
  });

  final String id;
  final String name;
  final String description;
  final CatalogItemType itemType;
  final String uom; // services only: "Sq.Ft" | "Point" | "No" | "Rft"
  final String defaultSection; // grouping label, e.g. "Modular Kitchen"
  final List<CatalogVariant> variants;
  final bool active;

  PricingBasis get pricingBasis => itemType.pricingBasis;

  CatalogItemEntity copyWith({
    String? id,
    String? name,
    String? description,
    CatalogItemType? itemType,
    String? uom,
    String? defaultSection,
    List<CatalogVariant>? variants,
    bool? active,
  }) {
    return CatalogItemEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      itemType: itemType ?? this.itemType,
      uom: uom ?? this.uom,
      defaultSection: defaultSection ?? this.defaultSection,
      variants: variants ?? this.variants,
      active: active ?? this.active,
    );
  }
}
