import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory CatalogItemModel.fromJson(Map<String, dynamic> data) {
    return CatalogItemModel(
      id: apiString(data['id']),
      name: apiString(data['name']),
      description: apiString(data['description']),
      itemType: CatalogItemTypeX.fromName(data['itemType'] as String?),
      uom: apiString(data['uom']),
      defaultSection: apiString(data['defaultSection']),
      variants: ((data['variants'] as List?) ?? [])
          .map((v) => CatalogVariant.fromJson(Map<String, dynamic>.from(v as Map)))
          .toList(),
      active: data['active'] as bool? ?? true,
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
