/**
 * Client-side quotation PDF (@react-pdf/renderer). Only ever loaded with a
 * dynamic `import()` from `pdf-download.ts`, so the renderer stays out of every
 * page bundle until someone clicks "Download PDF".
 *
 * Same layout as the mobile app's QuotationPdfService and the API's pdfkit
 * version (velan-backend/src/modules/sales/quote-pdf.ts): optional full-bleed
 * cover page, PROPOSAL header + logo, Prepared By / For, metadata table,
 * not-included list, room-wise tables (columns by section type), totals
 * (subtotal → discount → GST → round-off → grand total), terms, signatures,
 * a low-opacity logo watermark and a footer with page numbers on every
 * content page. NotoSans is registered so ₹ renders.
 */

import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { formatDate, formatINR } from "@/lib/format";
import {
  CATALOG_ITEM_TYPE_LABELS,
  type CatalogItemType,
  type QuotationSettings,
  type Quote,
  type QuoteItem,
  type QuoteSection,
} from "@/lib/api/sales-types";
import { qtyLabel, quoteBreakdown, sizeLabel } from "@/lib/quote-calc";

const MAROON = "#7A1F2B";
const MAROON_LIGHT = "#F3E9EA";
const GREY = "#6B7280";
const LINE_GREY = "#E5E7EB";
const MUTED_BG = "#FAFAFA";
const BLACK = "#111111";

const FALLBACK_LOGO = "/brand/logo.png";
const FONT = "NotoSans";

const COLUMN_LABELS: Record<CatalogItemType, [string, string]> = {
  component: ["Type/Variant", "Size (mm)"],
  accessory: ["Brand", "Qty"],
  service: ["UOM", "Qty"],
};

// ------------------------------------------------------------------ assets

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const origin = window.location.origin;
  Font.register({
    family: FONT,
    fonts: [
      { src: `${origin}/fonts/NotoSans-Regular.ttf`, fontWeight: "normal" },
      { src: `${origin}/fonts/NotoSans-Bold.ttf`, fontWeight: "bold" },
    ],
  });
  // Don't hyphenate names, brands or sizes.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * PNG/JPEG as a data URL, or null (missing, unreachable, CORS-blocked or an
 * unsupported format). A failed image never fails the PDF.
 */
async function loadImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
    const res = await fetch(url, { credentials: sameOrigin ? "same-origin" : "omit", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g)$/i.test(blob.type)) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ styles

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 32, paddingBottom: 64, fontFamily: FONT, fontSize: 10, color: BLACK },
  coverPage: { padding: 0 },
  // Absolute at exact A4 size (595.28 × 841.89 pt) so the image never takes part in pagination.
  cover: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841.89, objectFit: "cover" },
  watermarkWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  watermark: { width: 360, height: 360, objectFit: "contain", opacity: 0.06 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 30, fontWeight: "bold", color: MAROON },
  titleBar: { width: 90, height: 3, backgroundColor: MAROON, marginTop: 2 },
  subtitle: { fontSize: 12, color: GREY, marginTop: 6 },
  logo: { maxWidth: 200, height: 56, objectFit: "contain" },

  block: { borderWidth: 1, borderColor: LINE_GREY, borderRadius: 6, padding: 14, marginBottom: 14, backgroundColor: "#FFFFFF" },
  blockLabel: { fontSize: 9, fontWeight: "bold", color: MAROON, letterSpacing: 1 },
  blockName: { fontSize: 16, fontWeight: "bold", marginTop: 4 },
  blockLine: { fontSize: 10, color: GREY, marginTop: 2 },

  meta: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: LINE_GREY, marginBottom: 16, marginTop: 2 },
  metaRow: { flexDirection: "row" },
  metaCell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE_GREY, paddingVertical: 8, paddingHorizontal: 10 },
  metaLabel: { fontSize: 10, color: GREY },
  metaValue: { fontSize: 10, fontWeight: "bold" },

  niTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 6 },
  niItem: { fontSize: 10, marginBottom: 2 },

  sectionHead: {
    backgroundColor: MAROON_LIGHT,
    borderLeftWidth: 4,
    borderLeftColor: MAROON,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: MAROON },
  table: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: LINE_GREY, marginBottom: 16 },
  tr: { flexDirection: "row" },
  th: {
    backgroundColor: MAROON,
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: LINE_GREY,
  },
  td: { fontSize: 9.5, paddingVertical: 7, paddingHorizontal: 8, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: LINE_GREY },
  itemName: { fontSize: 10, fontWeight: "bold", color: MAROON },
  itemDesc: { fontSize: 8.5, color: GREY },
  amount: { fontWeight: "bold", color: MAROON, textAlign: "right" },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end" },
  totals: { width: 260 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 10, color: GREY },
  totalValue: { fontSize: 11, fontWeight: "bold" },
  totalRule: { borderBottomWidth: 1, borderBottomColor: LINE_GREY, marginVertical: 4 },
  grandLabel: { fontSize: 13, fontWeight: "bold", color: MAROON },
  grandValue: { fontSize: 14, fontWeight: "bold", color: MAROON },

  termsTitle: { fontSize: 11, fontWeight: "bold", marginTop: 20, marginBottom: 4 },
  terms: { fontSize: 9, color: GREY, lineHeight: 1.4 },

  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 50 },
  signature: { width: 150, alignItems: "center" },
  signatureLine: { width: 150, borderTopWidth: 0.8, borderTopColor: GREY, marginBottom: 4 },
  signatureLabel: { fontSize: 9, color: GREY },

  footer: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE_GREY,
    paddingTop: 6,
    fontSize: 8,
    color: GREY,
  },
  footerLeft: { width: 160 },
  footerMid: { flex: 1, textAlign: "center", paddingHorizontal: 6 },
  footerRight: { width: 90, textAlign: "right" },
});

// ------------------------------------------------------------------ pieces

const has = (v: string | null | undefined): v is string => typeof v === "string" && v.trim() !== "";
const joinDot = (...parts: (string | null | undefined)[]) => parts.filter(has).join("   •   ");
const dash = (v: string | null | undefined) => (has(v) ? v : "—");
const pdfDate = (v: string | null | undefined) => (has(v) ? formatDate(v) : "—");
const trimNum = (n: number) => String(Math.round(n * 100) / 100);

function Prepared({ label, name, lines }: { label: string; name: string | null; lines: string[] }) {
  return (
    <View style={s.block} wrap={false}>
      <Text style={s.blockLabel}>{label}</Text>
      <Text style={s.blockName}>{has(name) ? name.trim() : "—"}</Text>
      {lines.filter(has).map((line, i) => (
        <Text key={i} style={s.blockLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function Metadata({ quote }: { quote: Quote }) {
  const label = (t: string) => (
    <View style={[s.metaCell, { width: "20.6%", backgroundColor: MUTED_BG }]}>
      <Text style={s.metaLabel}>{t}</Text>
    </View>
  );
  const value = (t: string, width = "29.4%") => (
    <View style={[s.metaCell, { width }]}>
      <Text style={s.metaValue}>{t}</Text>
    </View>
  );
  const rows: [string, string, string, string][] = [
    ["Quote No.", dash(quote.quoteNumber), "Project Type", dash(quote.projectType)],
    ["Date", pdfDate(quote.quoteDate), "Handled By", dash(quote.handledBy)],
    ["Valid Until", pdfDate(quote.validUntil), "Designed By", dash(quote.designedBy)],
    ["Enquiry Date", pdfDate(quote.enquiryDate), "Enquiry No.", dash(quote.enquiryNo)],
  ];
  return (
    <View style={s.meta} wrap={false}>
      {rows.map(([a, b, c, d]) => (
        <View key={a} style={s.metaRow}>
          {label(a)}
          {value(b)}
          {label(c)}
          {value(d)}
        </View>
      ))}
      <View style={s.metaRow}>
        {label("Site Location")}
        {value(dash(quote.siteLocation), "79.4%")}
      </View>
    </View>
  );
}

const COL_WIDTHS = ["7.6%", "40.2%", "18.1%", "18.1%", "16%"];

function ItemRow({ item, index, type }: { item: QuoteItem; index: number; type: CatalogItemType }) {
  const col3 = !item.variantLabel && type === "service" ? item.uom : item.variantLabel;
  const col4 = type === "component" ? sizeLabel(item) : qtyLabel(item.qty);
  return (
    <View style={s.tr} wrap={false}>
      <Text style={[s.td, { width: COL_WIDTHS[0] }]}>{index + 1}</Text>
      <View style={[s.td, { width: COL_WIDTHS[1] }]}>
        <Text style={s.itemName}>{item.name || "—"}</Text>
        {has(item.description) && <Text style={s.itemDesc}>{item.description}</Text>}
      </View>
      <Text style={[s.td, { width: COL_WIDTHS[2] }]}>{col3}</Text>
      <Text style={[s.td, { width: COL_WIDTHS[3] }]}>{col4}</Text>
      <Text style={[s.td, s.amount, { width: COL_WIDTHS[4] }]}>{formatINR(item.amount)}</Text>
    </View>
  );
}

function Section({ section }: { section: QuoteSection }) {
  const type = section.type;
  const [col3, col4] = COLUMN_LABELS[type];
  const headers = ["S.No", CATALOG_ITEM_TYPE_LABELS[type], col3, col4, "Amount"];
  const [first, ...rest] = section.items;
  return (
    <View>
      {/* Keep the room title with the table header and its first row. */}
      <View wrap={false}>
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>{has(section.title) ? section.title : CATALOG_ITEM_TYPE_LABELS[type]}</Text>
        </View>
        <View style={[s.table, { marginBottom: 0 }]}>
          <View style={s.tr}>
            {headers.map((h, i) => (
              <Text key={h} style={[s.th, { width: COL_WIDTHS[i] }, i === 4 ? { textAlign: "right" } : {}]}>
                {h}
              </Text>
            ))}
          </View>
          {first && <ItemRow item={first} index={0} type={type} />}
        </View>
      </View>
      <View style={[s.table, { borderTopWidth: 0 }]}>
        {rest.map((item, i) => (
          <ItemRow key={i} item={item} index={i + 1} type={type} />
        ))}
      </View>
    </View>
  );
}

function Totals({ quote, round }: { quote: Quote; round: boolean }) {
  const b = quoteBreakdown({
    sections: quote.sections,
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    gstPercent: quote.gstPercent,
    round,
  });
  const rows: [string, string][] = [["Subtotal", formatINR(b.subtotal)]];
  if (b.discount > 0) {
    rows.push([
      quote.discountType === "percent" ? `Discount (${trimNum(quote.discountValue)}%)` : "Discount",
      `- ${formatINR(b.discount)}`,
    ]);
  }
  if (quote.gstPercent > 0) rows.push([`GST (${trimNum(quote.gstPercent)}%)`, `+ ${formatINR(b.gstAmount)}`]);
  if (b.roundOff !== 0) rows.push(["Round Off", `${b.roundOff > 0 ? "+" : "-"} ${formatINR(Math.abs(b.roundOff))}`]);

  return (
    <View style={s.totalsWrap} wrap={false}>
      <View style={s.totals}>
        {rows.map(([label, value]) => (
          <View key={label} style={s.totalRow}>
            <Text style={s.totalLabel}>{label}</Text>
            <Text style={s.totalValue}>{value}</Text>
          </View>
        ))}
        <View style={s.totalRule} />
        <View style={s.totalRow}>
          <Text style={s.grandLabel}>Grand Total</Text>
          <Text style={s.grandValue}>{formatINR(Math.max(0, b.payable))}</Text>
        </View>
      </View>
    </View>
  );
}

type Assets = { cover: string | null; logo: string | null; watermark: string | null };

export function QuotePdfDocument({ quote, settings, assets }: { quote: Quote; settings: QuotationSettings; assets: Assets }) {
  const hasCover = assets.cover !== null;
  const footerMid = has(settings.footerText) ? settings.footerText : [settings.email, settings.phone].filter(has).join("  •  ");
  const title = quote.quoteNumber ? `Quotation ${quote.quoteNumber}` : "Quotation";

  return (
    <Document title={title} author={settings.companyName || undefined} creator="Velan Spaces" producer="Velan Spaces">
      {hasCover && (
        <Page size="A4" style={s.coverPage} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
          <Image src={assets.cover!} style={s.cover} />
        </Page>
      )}
      <Page size="A4" style={s.page}>
        {assets.watermark && (
          <View style={s.watermarkWrap} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image src={assets.watermark} style={s.watermark} />
          </View>
        )}

        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>PROPOSAL</Text>
            <View style={s.titleBar} />
            <Text style={s.subtitle}>Final Quote</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
          {assets.logo && <Image src={assets.logo} style={s.logo} />}
        </View>

        <Prepared
          label="PREPARED BY"
          name={settings.companyName}
          lines={[joinDot(settings.phone, settings.email), settings.address]}
        />
        <Prepared
          label="PREPARED FOR"
          name={quote.preparedForName}
          lines={[joinDot(quote.preparedForPhone, quote.preparedForEmail), quote.preparedForAddress ?? ""]}
        />
        <Metadata quote={quote} />

        {quote.notIncluded.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={s.niTitle} minPresenceAhead={20}>
              Not Included Items:
            </Text>
            {quote.notIncluded.map((line, i) => (
              <Text key={i} style={s.niItem}>
                {`•  ${line}`}
              </Text>
            ))}
          </View>
        )}

        {quote.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}

        <Totals quote={quote} round={settings.roundAmounts} />

        {has(settings.defaultTerms) && (
          <View>
            <Text style={s.termsTitle} minPresenceAhead={30}>
              Terms &amp; Conditions
            </Text>
            <Text style={s.terms}>{settings.defaultTerms}</Text>
          </View>
        )}

        <View style={s.signatures} wrap={false}>
          {["Client Signature", "Authorised Signatory"].map((label) => (
            <View key={label} style={s.signature}>
              <View style={s.signatureLine} />
              <Text style={s.signatureLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>{settings.companyName}</Text>
          <Text style={s.footerMid}>{footerMid}</Text>
          <Text
            style={s.footerRight}
            render={({ pageNumber, totalPages }) =>
              hasCover ? `Page ${pageNumber - 1}/${totalPages - 1}` : `Page ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Renders the quote to a PDF Blob in the browser. */
export async function renderQuotePdf(quote: Quote, settings: QuotationSettings): Promise<Blob> {
  registerFonts();
  const [cover, logo, watermark] = await Promise.all([
    loadImage(settings.coverImageUrl),
    loadImage(settings.logoUrl),
    loadImage(settings.watermarkLogoUrl),
  ]);
  const brand = logo ?? (await loadImage(FALLBACK_LOGO));
  // Watermark falls back to the header logo (mobile rule), then the bundled logo.
  const assets: Assets = { cover, logo: brand, watermark: watermark ?? brand };
  return pdf(<QuotePdfDocument quote={quote} settings={settings} assets={assets} />).toBlob();
}
