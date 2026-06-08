import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';

/// Pure costing engine for quotations. No I/O, no Flutter — easy to unit test.
///
/// Formulas (from the locked plan):
/// - area : amount = (L×H → sq.ft) × rate
/// - qty  : amount = qty × unit price
/// - uom  : amount = qty × rate per UOM
class QuoteCalculator {
  static const double _mmPerFoot = 304.8;
  static const double _sqMmPerSqFt = _mmPerFoot * _mmPerFoot; // 92903.04

  /// Converts L×H millimetres to square feet.
  static double areaSqft(double lengthMm, double heightMm) =>
      (lengthMm * heightMm) / _sqMmPerSqFt;

  /// Computes a single line amount for the given pricing [basis] and inputs.
  static double lineAmount({
    required PricingBasis basis,
    double? lengthMm,
    double? heightMm,
    double? qty,
    required double rate,
    bool round = true,
  }) {
    double amt;
    switch (basis) {
      case PricingBasis.area:
        amt = areaSqft(lengthMm ?? 0, heightMm ?? 0) * rate;
        break;
      case PricingBasis.qty:
      case PricingBasis.uom:
        amt = (qty ?? 0) * rate;
        break;
    }
    return round ? amt.roundToDouble() : amt;
  }

  /// Recomputes [item.amount] from its current inputs.
  static QuoteItem recomputeItem(QuoteItem item, {bool round = true}) {
    return item.copyWith(
      amount: lineAmount(
        basis: item.pricingBasis,
        lengthMm: item.lengthMm,
        heightMm: item.heightMm,
        qty: item.qty,
        rate: item.rate,
        round: round,
      ),
    );
  }

  static double sectionSubtotal(List<QuoteItem> items) =>
      items.fold(0.0, (sum, i) => sum + i.amount);

  static double subtotal(List<QuoteSection> sections) =>
      sections.fold(0.0, (sum, s) => sum + sectionSubtotal(s.items));

  /// Discount amount (₹) for the chosen type.
  static double discountAmount({
    required double subtotal,
    required DiscountType type,
    required double value,
  }) =>
      type == DiscountType.percent ? subtotal * value / 100 : value;

  /// subtotal − discount, then + GST%, optionally rounded to whole ₹.
  static double grandTotal({
    required double subtotal,
    required DiscountType discountType,
    required double discountValue,
    required double gstPercent,
    bool round = true,
  }) {
    final discount = discountAmount(
      subtotal: subtotal,
      type: discountType,
      value: discountValue,
    );
    final afterDiscount = (subtotal - discount).clamp(0.0, double.infinity);
    final total = afterDiscount * (1 + gstPercent / 100);
    return round ? total.roundToDouble() : total;
  }

  /// Returns a copy of [quote] with every line amount, the subtotal and the
  /// grand total recomputed — call this whenever inputs change before saving.
  static QuoteEntity recomputeQuote(QuoteEntity quote, {bool round = true}) {
    final sections = quote.sections
        .map((s) => s.copyWith(
              items: s.items.map((i) => recomputeItem(i, round: round)).toList(),
            ))
        .toList();
    final sub = subtotal(sections);
    final total = grandTotal(
      subtotal: sub,
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      gstPercent: quote.gstPercent,
      round: round,
    );
    return quote.copyWith(sections: sections, subtotal: sub, grandTotal: total);
  }
}
