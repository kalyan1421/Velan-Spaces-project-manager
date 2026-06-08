import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_template_entity.dart';

class QuoteTemplateModel extends QuoteTemplateEntity {
  const QuoteTemplateModel({
    required super.id,
    required super.name,
    super.sections,
  });

  static Map<String, dynamic> _lineToJson(QuoteTemplateLine l) => {
        'catalogItemId': l.catalogItemId,
        'name': l.name,
        'itemType': l.itemType.name,
        'variantLabel': l.variantLabel,
        'defaultLengthMm': l.defaultLengthMm,
        'defaultHeightMm': l.defaultHeightMm,
        'defaultQty': l.defaultQty,
        'uom': l.uom,
      };

  static QuoteTemplateLine _lineFromJson(Map<String, dynamic> j) =>
      QuoteTemplateLine(
        catalogItemId: j['catalogItemId'] ?? '',
        name: j['name'] ?? '',
        itemType: CatalogItemTypeX.fromName(j['itemType'] as String?),
        variantLabel: j['variantLabel'] ?? '',
        defaultLengthMm: (j['defaultLengthMm'] as num?)?.toDouble(),
        defaultHeightMm: (j['defaultHeightMm'] as num?)?.toDouble(),
        defaultQty: (j['defaultQty'] as num?)?.toDouble(),
        uom: j['uom'] ?? '',
      );

  static Map<String, dynamic> _sectionToJson(QuoteTemplateSection s) => {
        'title': s.title,
        'type': s.type.name,
        'lines': s.lines.map(_lineToJson).toList(),
      };

  static QuoteTemplateSection _sectionFromJson(Map<String, dynamic> j) =>
      QuoteTemplateSection(
        title: j['title'] ?? '',
        type: CatalogItemTypeX.fromName(j['type'] as String?),
        lines: ((j['lines'] as List?) ?? [])
            .map((e) => _lineFromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );

  factory QuoteTemplateModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>? ?? {};
    return QuoteTemplateModel(
      id: snap.id,
      name: data['name'] ?? '',
      sections: ((data['sections'] as List?) ?? [])
          .map((e) => _sectionFromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }

  factory QuoteTemplateModel.fromEntity(QuoteTemplateEntity e) =>
      QuoteTemplateModel(id: e.id, name: e.name, sections: e.sections);

  Map<String, dynamic> toJson() => {
        'name': name,
        'sections': sections.map(_sectionToJson).toList(),
      };
}
