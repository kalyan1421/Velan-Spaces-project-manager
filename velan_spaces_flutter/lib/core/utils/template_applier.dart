import 'package:velan_spaces_flutter/core/utils/quote_calculator.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_template_entity.dart';

/// Instantiates a [QuoteTemplateEntity] into concrete [QuoteSection]s, pulling
/// the *current* rate for each line from [catalog] (the rate card is the source
/// of truth) and computing amounts from the template's default dimensions.
class TemplateApplier {
  static List<QuoteSection> apply(
    QuoteTemplateEntity template,
    List<CatalogItemEntity> catalog, {
    bool round = true,
  }) {
    return template.sections.map((s) {
      final items = <QuoteItem>[];
      for (final line in s.lines) {
        final catalogItem = catalog
            .where((c) => c.id == line.catalogItemId)
            .cast<CatalogItemEntity?>()
            .firstWhere((_) => true, orElse: () => null);

        // Resolve rate from the current catalog; fall back gracefully.
        double rate = 0;
        String variantLabel = line.variantLabel;
        String name = line.name;
        String uom = line.uom;
        CatalogItemType itemType = line.itemType;

        if (catalogItem != null) {
          name = catalogItem.name;
          uom = catalogItem.uom;
          itemType = catalogItem.itemType;
          final variant = catalogItem.variants
              .where((v) => v.label == line.variantLabel)
              .cast<CatalogVariant?>()
              .firstWhere((_) => true, orElse: () => null);
          final resolved = variant ??
              (catalogItem.variants.isNotEmpty
                  ? catalogItem.variants.first
                  : null);
          if (resolved != null) {
            rate = resolved.rate;
            variantLabel = resolved.label;
          }
        }

        final amount = QuoteCalculator.lineAmount(
          basis: itemType.pricingBasis,
          lengthMm: line.defaultLengthMm,
          heightMm: line.defaultHeightMm,
          qty: line.defaultQty,
          rate: rate,
          round: round,
        );

        items.add(QuoteItem(
          catalogItemId: line.catalogItemId,
          name: name,
          itemType: itemType,
          variantLabel: variantLabel,
          lengthMm: line.defaultLengthMm,
          heightMm: line.defaultHeightMm,
          qty: line.defaultQty,
          uom: uom,
          rate: rate,
          amount: amount,
        ));
      }
      return QuoteSection(title: s.title, type: s.type, items: items);
    }).toList();
  }
}
