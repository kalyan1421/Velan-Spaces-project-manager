import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:velan_spaces_flutter/core/utils/format_utils.dart';
import 'package:velan_spaces_flutter/core/utils/quote_calculator.dart';
import 'package:velan_spaces_flutter/domain/entities/catalog_item_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quotation_settings_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/quote_entity.dart';

/// Builds the branded quotation PDF: admin-uploaded cover image, "Prepared
/// By/For" blocks, metadata table, room-wise line-item tables, totals, terms,
/// a logo watermark on every page and a company footer.
///
/// Uses NotoSans (fetched via Google Fonts) so the ₹ glyph renders correctly.
class QuotationPdfService {
  static const PdfColor _maroon = PdfColor.fromInt(0xFF7A1F2B);
  static const PdfColor _maroonLight = PdfColor.fromInt(0xFFF3E9EA);
  static const PdfColor _grey = PdfColor.fromInt(0xFF6B7280);
  static const PdfColor _lineGrey = PdfColor.fromInt(0xFFE5E7EB);

  /// Renders the quote to PDF bytes. [quote] amounts are recomputed defensively
  /// so the document always agrees with the rate card.
  static Future<Uint8List> build({
    required QuoteEntity quote,
    required QuotationSettingsEntity settings,
  }) async {
    final q = QuoteCalculator.recomputeQuote(quote, round: settings.roundAmounts);

    final doc = pw.Document();
    final base = await PdfGoogleFonts.notoSansRegular();
    final bold = await PdfGoogleFonts.notoSansBold();
    final theme = pw.ThemeData.withFont(base: base, bold: bold);

    final cover = await _tryImage(settings.coverImageUrl);
    final logo = await _tryImage(settings.logoUrl);
    final watermark = await _tryImage(settings.effectiveWatermarkUrl);

    // ── Cover page (admin-uploaded) ──────────────────────────────────────
    if (cover != null) {
      doc.addPage(pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (_) => pw.Image(cover, fit: pw.BoxFit.cover),
      ));
    }

    // ── Content pages ────────────────────────────────────────────────────
    doc.addPage(pw.MultiPage(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4,
        theme: theme,
        margin: const pw.EdgeInsets.fromLTRB(32, 36, 32, 42),
        buildBackground: watermark == null
            ? null
            : (ctx) => pw.FullPage(
                  ignoreMargins: true,
                  child: pw.Center(
                    child: pw.Opacity(
                      opacity: 0.06,
                      child: pw.Image(watermark, width: 360),
                    ),
                  ),
                ),
      ),
      footer: (ctx) => _footer(settings, ctx),
      build: (ctx) => [
        _titleRow(logo),
        pw.SizedBox(height: 20),
        _preparedBlock('PREPARED BY', settings.companyName,
            ['${settings.phone}   •   ${settings.email}', settings.address]),
        pw.SizedBox(height: 14),
        _preparedBlock('PREPARED FOR', q.preparedForName,
            [q.preparedForPhone, q.preparedForAddress]),
        pw.SizedBox(height: 16),
        _metadataTable(q),
        pw.SizedBox(height: 16),
        if (q.notIncluded.isNotEmpty) ...[
          _notIncluded(q),
          pw.SizedBox(height: 16),
        ],
        for (final section in q.sections) ...[
          _sectionHeader(section.title),
          pw.SizedBox(height: 8),
          _sectionTable(section),
          pw.SizedBox(height: 16),
        ],
        _totals(q, settings),
        if (settings.defaultTerms.isNotEmpty) ...[
          pw.SizedBox(height: 20),
          _terms(settings.defaultTerms),
        ],
        pw.SizedBox(height: 30),
        _signature(),
      ],
    ));

    return doc.save();
  }

  static Future<pw.ImageProvider?> _tryImage(String url) async {
    if (url.isEmpty) return null;
    try {
      return await networkImage(url);
    } catch (_) {
      return null;
    }
  }

  // ── Header / title ─────────────────────────────────────────────────────
  static pw.Widget _titleRow(pw.ImageProvider? logo) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text('PROPOSAL',
                style: pw.TextStyle(
                    fontSize: 30,
                    fontWeight: pw.FontWeight.bold,
                    color: _maroon)),
            pw.Container(
                margin: const pw.EdgeInsets.only(top: 4),
                width: 90,
                height: 3,
                color: _maroon),
            pw.SizedBox(height: 6),
            pw.Text('Final Quote',
                style: pw.TextStyle(fontSize: 12, color: _grey)),
          ],
        ),
        if (logo != null) pw.SizedBox(height: 56, child: pw.Image(logo)),
      ],
    );
  }

  static pw.Widget _preparedBlock(
      String label, String name, List<String> lines) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.all(14),
      decoration: pw.BoxDecoration(
        color: PdfColors.white,
        border: pw.Border.all(color: _lineGrey),
        borderRadius: pw.BorderRadius.circular(6),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(label,
              style: pw.TextStyle(
                  fontSize: 9,
                  color: _maroon,
                  fontWeight: pw.FontWeight.bold,
                  letterSpacing: 1)),
          pw.SizedBox(height: 4),
          pw.Text(name,
              style:
                  pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          ...lines
              .where((l) => l.trim().isNotEmpty)
              .map((l) => pw.Padding(
                  padding: const pw.EdgeInsets.only(top: 2),
                  child: pw.Text(l,
                      style: pw.TextStyle(fontSize: 10, color: _grey)))),
        ],
      ),
    );
  }

  static pw.Widget _metadataTable(QuoteEntity q) {
    String d(DateTime? x) => x != null ? FormatUtils.formatDate(x) : '—';
    final rows = <List<String>>[
      ['Date', d(q.date), 'Handled By', q.handledBy],
      ['Valid Until', d(q.validUntil), 'Designed By', q.designedBy],
      ['Enquiry Date', d(q.enquiryDate), 'Enquiry No.', q.enquiryNo],
      ['Site Location', q.siteLocation, 'Project Type', q.projectType],
    ];
    return pw.Table(
      border: pw.TableBorder.all(color: _lineGrey),
      columnWidths: const {
        0: pw.FlexColumnWidth(1.4),
        1: pw.FlexColumnWidth(2),
        2: pw.FlexColumnWidth(1.4),
        3: pw.FlexColumnWidth(2),
      },
      children: rows
          .map((r) => pw.TableRow(children: [
                _metaCell(r[0], muted: true),
                _metaCell(r[1]),
                _metaCell(r[2], muted: true),
                _metaCell(r[3]),
              ]))
          .toList(),
    );
  }

  static pw.Widget _metaCell(String text, {bool muted = false}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      color: muted ? PdfColors.grey50 : PdfColors.white,
      child: pw.Text(text.isEmpty ? '—' : text,
          style: pw.TextStyle(
              fontSize: 10,
              color: muted ? _grey : PdfColors.black,
              fontWeight: muted ? pw.FontWeight.normal : pw.FontWeight.bold)),
    );
  }

  static pw.Widget _notIncluded(QuoteEntity q) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text('Not Included Items:',
            style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 6),
        ...q.notIncluded.map((e) => pw.Padding(
              padding: const pw.EdgeInsets.only(bottom: 2),
              child: pw.Text('•  $e', style: const pw.TextStyle(fontSize: 10)),
            )),
      ],
    );
  }

  // ── Sections ───────────────────────────────────────────────────────────
  static pw.Widget _sectionHeader(String title) {
    return pw.Container(
      width: double.infinity,
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: pw.BoxDecoration(
        color: _maroonLight,
        border: pw.Border(left: pw.BorderSide(color: _maroon, width: 4)),
      ),
      child: pw.Text(title,
          style: pw.TextStyle(
              fontSize: 13, fontWeight: pw.FontWeight.bold, color: _maroon)),
    );
  }

  static pw.Widget _sectionTable(QuoteSection section) {
    final (col3Label, col4Label) = switch (section.type) {
      CatalogItemType.component => ('Type/Variant', 'Size (mm)'),
      CatalogItemType.accessory => ('Brand', 'Qty'),
      CatalogItemType.service => ('UOM', 'Qty'),
    };
    final headers = ['S.No', section.type.label, col3Label, col4Label, 'Amount'];

    String col4(QuoteItem i) => switch (section.type) {
          CatalogItemType.component => i.sizeLabel,
          _ => i.qty == null
              ? ''
              : (i.qty == i.qty!.roundToDouble()
                  ? i.qty!.toInt().toString()
                  : i.qty!.toStringAsFixed(2)),
        };

    return pw.Table(
      border: pw.TableBorder.all(color: _lineGrey, width: 0.5),
      columnWidths: const {
        0: pw.FixedColumnWidth(34),
        1: pw.FlexColumnWidth(4),
        2: pw.FlexColumnWidth(1.8),
        3: pw.FlexColumnWidth(1.8),
        4: pw.FlexColumnWidth(1.6),
      },
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: _maroon),
          children: headers.asMap().entries.map((e) {
            final isAmount = e.key == 4;
            return pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
              alignment: isAmount ? pw.Alignment.centerRight : pw.Alignment.centerLeft,
              child: pw.Text(e.value,
                  style: pw.TextStyle(
                      color: PdfColors.white,
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold)),
            );
          }).toList(),
        ),
        ...section.items.asMap().entries.map((e) {
          final i = e.value;
          return pw.TableRow(children: [
            _cell('${e.key + 1}'),
            _itemCell(i),
            _cell(i.variantLabel.isEmpty && section.type == CatalogItemType.service
                ? i.uom
                : i.variantLabel),
            _cell(col4(i)),
            _cell(FormatUtils.formatCurrency(i.amount), amount: true),
          ]);
        }),
      ],
    );
  }

  static pw.Widget _cell(String text, {bool amount = false}) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      alignment: amount ? pw.Alignment.centerRight : pw.Alignment.centerLeft,
      child: pw.Text(text,
          style: pw.TextStyle(
              fontSize: 9.5,
              color: amount ? _maroon : PdfColors.black,
              fontWeight: amount ? pw.FontWeight.bold : pw.FontWeight.normal)),
    );
  }

  static pw.Widget _itemCell(QuoteItem i) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(i.name,
              style: pw.TextStyle(
                  fontSize: 10, fontWeight: pw.FontWeight.bold, color: _maroon)),
          if (i.description.isNotEmpty)
            pw.Text(i.description,
                style: pw.TextStyle(fontSize: 8.5, color: _grey)),
        ],
      ),
    );
  }

  // ── Totals ─────────────────────────────────────────────────────────────
  static pw.Widget _totals(QuoteEntity q, QuotationSettingsEntity settings) {
    final discount = QuoteCalculator.discountAmount(
        subtotal: q.subtotal, type: q.discountType, value: q.discountValue);
    final afterDiscount = q.subtotal - discount;
    final gstAmount = afterDiscount * q.gstPercent / 100;

    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.end,
      children: [
        pw.SizedBox(
          width: 260,
          child: pw.Column(
            children: [
              _totalRow('Subtotal', FormatUtils.formatCurrency(q.subtotal)),
              if (discount > 0)
                _totalRow(
                    q.discountType == DiscountType.percent
                        ? 'Discount (${q.discountValue.toStringAsFixed(0)}%)'
                        : 'Discount',
                    '- ${FormatUtils.formatCurrency(discount)}'),
              if (q.gstPercent > 0)
                _totalRow('GST (${q.gstPercent.toStringAsFixed(0)}%)',
                    '+ ${FormatUtils.formatCurrency(gstAmount)}'),
              pw.Divider(color: _lineGrey),
              _totalRow('Grand Total',
                  FormatUtils.formatCurrency(q.grandTotal),
                  emphasize: true),
            ],
          ),
        ),
      ],
    );
  }

  static pw.Widget _totalRow(String label, String value,
      {bool emphasize = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 3),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label,
              style: pw.TextStyle(
                  fontSize: emphasize ? 13 : 10,
                  fontWeight:
                      emphasize ? pw.FontWeight.bold : pw.FontWeight.normal,
                  color: emphasize ? _maroon : _grey)),
          pw.Text(value,
              style: pw.TextStyle(
                  fontSize: emphasize ? 14 : 11,
                  fontWeight: pw.FontWeight.bold,
                  color: emphasize ? _maroon : PdfColors.black)),
        ],
      ),
    );
  }

  static pw.Widget _terms(String terms) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text('Terms & Conditions',
            style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        pw.Text(terms, style: pw.TextStyle(fontSize: 9, color: _grey)),
      ],
    );
  }

  static pw.Widget _signature() {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Column(children: [
          pw.Container(width: 150, height: 0.8, color: _grey),
          pw.SizedBox(height: 4),
          pw.Text('Client Signature',
              style: pw.TextStyle(fontSize: 9, color: _grey)),
        ]),
        pw.Column(children: [
          pw.Container(width: 150, height: 0.8, color: _grey),
          pw.SizedBox(height: 4),
          pw.Text('Authorised Signatory',
              style: pw.TextStyle(fontSize: 9, color: _grey)),
        ]),
      ],
    );
  }

  // ── Footer (every page) ──────────────────────────────────────────────────
  static pw.Widget _footer(QuotationSettingsEntity settings, pw.Context ctx) {
    final left = settings.companyName;
    final mid = settings.footerText.isNotEmpty
        ? settings.footerText
        : '${settings.email}  •  ${settings.phone}';
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 8),
      padding: const pw.EdgeInsets.only(top: 6),
      decoration: const pw.BoxDecoration(
        border: pw.Border(top: pw.BorderSide(color: _lineGrey)),
      ),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(left, style: pw.TextStyle(fontSize: 8, color: _grey)),
          pw.Text(mid, style: pw.TextStyle(fontSize: 8, color: _grey)),
          pw.Text('Page ${ctx.pageNumber}/${ctx.pagesCount}',
              style: pw.TextStyle(fontSize: 8, color: _grey)),
        ],
      ),
    );
  }
}
