import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';

class CatalogItemModel extends CatalogItemEntity {
  const CatalogItemModel({
    required super.id,
    required super.name,
    super.description,
    super.itemType,
    super.uom,
    super.defaultSection,
    super.variants,
    super.active,
  });

  factory CatalogItemModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>? ?? {};
    return CatalogItemModel(
      id: snap.id,
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      itemType: CatalogItemTypeX.fromName(data['itemType'] as String?),
      uom: data['uom'] ?? '',
      defaultSection: data['defaultSection'] ?? '',
      variants: ((data['variants'] as List?) ?? [])
          .map((v) => CatalogVariant.fromJson(Map<String, dynamic>.from(v)))
          .toList(),
      active: data['active'] ?? true,
    );
  }

  factory CatalogItemModel.fromEntity(CatalogItemEntity e) => CatalogItemModel(
        id: e.id,
        name: e.name,
        description: e.description,
        itemType: e.itemType,
        uom: e.uom,
        defaultSection: e.defaultSection,
        variants: e.variants,
        active: e.active,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'description': description,
        'itemType': itemType.name,
        'uom': uom,
        'defaultSection': defaultSection,
        'variants': variants.map((v) => v.toJson()).toList(),
        'active': active,
      };
}
