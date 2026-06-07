import 'package:flutter/foundation.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';

/// A pre-configured line inside a template. References a catalog item (for the
/// current rate at apply-time) plus a default variant and default dimensions/qty.
@immutable
class QuoteTemplateLine {
  const QuoteTemplateLine({
    required this.catalogItemId,
    this.name = '',
    this.itemType = CatalogItemType.component,
    this.variantLabel = '',
    this.defaultLengthMm,
    this.defaultHeightMm,
    this.defaultQty,
    this.uom = '',
  });

  final String catalogItemId;
  final String name; // snapshot for display if catalog changes
  final CatalogItemType itemType;
  final String variantLabel;
  final double? defaultLengthMm;
  final double? defaultHeightMm;
  final double? defaultQty;
  final String uom;
}

@immutable
class QuoteTemplateSection {
  const QuoteTemplateSection({
    required this.title,
    this.type = CatalogItemType.component,
    this.lines = const [],
  });

  final String title;
  final CatalogItemType type;
  final List<QuoteTemplateLine> lines;

  QuoteTemplateSection copyWith({
    String? title,
    CatalogItemType? type,
    List<QuoteTemplateLine>? lines,
  }) {
    return QuoteTemplateSection(
      title: title ?? this.title,
      type: type ?? this.type,
      lines: lines ?? this.lines,
    );
  }
}

/// A reusable quote skeleton (e.g. "Standard 3BHK") an admin builds once so a
/// new quote starts mostly pre-filled.
@immutable
class QuoteTemplateEntity {
  const QuoteTemplateEntity({
    required this.id,
    required this.name,
    this.sections = const [],
  });

  final String id;
  final String name;
  final List<QuoteTemplateSection> sections;

  int get lineCount =>
      sections.fold(0, (sum, s) => sum + s.lines.length);

  QuoteTemplateEntity copyWith({
    String? id,
    String? name,
    List<QuoteTemplateSection>? sections,
  }) {
    return QuoteTemplateEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      sections: sections ?? this.sections,
    );
  }
}
