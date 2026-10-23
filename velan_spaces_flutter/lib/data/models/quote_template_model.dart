import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  static double? _opt(dynamic v) => v == null || v == '' ? null : apiDouble(v);

  static QuoteTemplateLine _lineFromJson(Map<String, dynamic> j) =>
      QuoteTemplateLine(
        catalogItemId: apiString(j['catalogItemId']),
        name: apiString(j['name']),
        itemType: CatalogItemTypeX.fromName(j['itemType'] as String?),
        variantLabel: apiString(j['variantLabel']),
        defaultLengthMm: _opt(j['defaultLengthMm']),
        defaultHeightMm: _opt(j['defaultHeightMm']),
        defaultQty: _opt(j['defaultQty']),
        uom: apiString(j['uom']),
      );

  static Map<String, dynamic> _sectionToJson(QuoteTemplateSection s) => {
        'title': s.title,
        'type': s.type.name,
        'lines': s.lines.map(_lineToJson).toList(),
      };

  static QuoteTemplateSection _sectionFromJson(Map<String, dynamic> j) =>
      QuoteTemplateSection(
        title: apiString(j['title']),
        type: CatalogItemTypeX.fromName(j['type'] as String?),
        lines: ((j['lines'] as List?) ?? [])
            .map((e) => _lineFromJson(Map<String, dynamic>.from(e as Map)))
            .toList(),
      );

  factory QuoteTemplateModel.fromJson(Map<String, dynamic> data) {
    return QuoteTemplateModel(
      id: apiString(data['id']),
      name: apiString(data['name']),
      sections: ((data['sections'] as List?) ?? [])
          .map((e) => _sectionFromJson(Map<String, dynamic>.from(e as Map)))
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
