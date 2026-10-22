/**
 * Sales / CRM types shared by the leads pipeline, the quote builder (A2W) and the
 * rate card / templates / quotation settings admin pages (A2A).
 *
 * Shapes follow `velan-backend/supabase/migrations/20260618170005_sales_crm.sql`
 * with camelCase keys (the API camelCases every response). Quote `sections` and
 * catalog `variants` are jsonb written by the mobile app, so their inner keys are
 * already camelCase. Postgres `numeric` columns may arrive as strings: run rows
 * through the `normalize*` helpers below before doing arithmetic.
 *
 * Pure module (no React, no fetch) — safe to import from server and client code.
 */

import { toNumber } from "@/lib/format";
import type { Money } from "./types";

export type { Money };

// ------------------------------------------------------------------ rate card

/** Drives the pricing formula and the PDF table columns. */
export const CATALOG_ITEM_TYPES = ["component", "accessory", "service"] as const;
export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];

export const CATALOG_ITEM_TYPE_LABELS: Record<CatalogItemType, string> = {
  component: "Component",
  accessory: "Accessory",
  service: "Service",
};

/** Plural, for section headings and pickers. */
export const CATALOG_ITEM_TYPE_PLURALS: Record<CatalogItemType, string> = {
  component: "Modular components",
  accessory: "Accessories",
  service: "Services",
};

/**
 * - `area`: amount = (L × H mm → sq.ft) × rate per sq.ft   (components)
 * - `qty` : amount = qty × unit price                      (accessories)
 * - `uom` : amount = qty × rate per UOM                    (services)
 */
export type PricingBasis = "area" | "qty" | "uom";

export function pricingBasisFor(type: CatalogItemType): PricingBasis {
  if (type === "component") return "area";
  if (type === "accessory") return "qty";
  return "uom";
}

/** Units a service can be priced in. */
export const SERVICE_UOMS = ["Sq.Ft", "Point", "No", "Rft"] as const;
export type ServiceUom = (typeof SERVICE_UOMS)[number];

export function isCatalogItemType(value: unknown): value is CatalogItemType {
  return typeof value === "string" && (CATALOG_ITEM_TYPES as readonly string[]).includes(value);
}

/** Unknown/legacy values fall back to `component`, as the mobile app does. */
export function toCatalogItemType(value: unknown): CatalogItemType {
  return isCatalogItemType(value) ? value : "component";
}

/**
 * A priced option. For components it is the rate per sq.ft, for services the rate
 * per UOM, for accessories the unit price. `label` is e.g. "Carcass • Premium" or
 * a brand ("Hettich").
 */
export type CatalogVariant = { id?: string; label: string; rate: number };

/** `GET /catalog-items` row (only active items are listed). */
export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  itemType: CatalogItemType;
  /** Services only: "Sq.Ft" | "Point" | "No" | "Rft". */
  uom: string | null;
  /** Grouping label, e.g. "Modular Kitchen". */
  defaultSection: string | null;
  variants: CatalogVariant[];
  active: boolean;
  createdAt?: string;
};

/** `POST /catalog-items` / `PATCH /catalog-items/:id` body. */
export type CatalogItemInput = {
  name: string;
  description?: string | null;
  itemType: CatalogItemType;
  uom?: string | null;
  defaultSection?: string | null;
  variants: CatalogVariant[];
  active?: boolean;
};

// ------------------------------------------------------------------ templates

/** A template line references a catalog item; its rate is resolved when the template is applied. */
export type QuoteTemplateLine = {
  /** Optional stable id (the API keeps it if sent). */
  id?: string;
  catalogItemId: string;
  /** Snapshot for display if the catalog item is later removed. */
  name: string;
  itemType: CatalogItemType;
  variantLabel: string;
  defaultLengthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  uom: string;
};

export type QuoteTemplateSection = {
  id?: string;
  title: string;
  type: CatalogItemType;
  lines: QuoteTemplateLine[];
};

/** `GET /quote-templates` row. */
export type QuoteTemplate = {
  id: string;
  name: string;
  sections: QuoteTemplateSection[];
  createdAt?: string;
};

/** `POST /quote-templates` / `PATCH /quote-templates/:id` body. */
export type QuoteTemplateInput = { name: string; sections: QuoteTemplateSection[] };

// ------------------------------------------------------------------ quotation settings

/** `GET /quotation-settings` (single row; may be null before the head saves it). */
export type QuotationSettings = {
  id?: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  /** Signed URLs in responses; write `sb://` refs back, never these URLs. */
  logoUrl: string;
  watermarkLogoUrl: string;
  coverImageUrl: string;
  footerText: string;
  defaultTerms: string;
  defaultNotIncluded: string[];
  quoteValidityDays: number;
  quoteNumberPrefix: string;
  defaultProjectType: string;
  defaultGstPercent: number;
  roundAmounts: boolean;
  updatedAt?: string;
};

/** `PUT /quotation-settings` body (head only). */
export type QuotationSettingsInput = Partial<Omit<QuotationSettings, "id" | "updatedAt">>;

export const DEFAULT_QUOTATION_SETTINGS: QuotationSettings = {
  companyName: "",
  phone: "",
  email: "",
  address: "",
  logoUrl: "",
  watermarkLogoUrl: "",
  coverImageUrl: "",
  footerText: "",
  defaultTerms: "",
  defaultNotIncluded: [],
  quoteValidityDays: 15,
  quoteNumberPrefix: "QUO-",
  defaultProjectType: "Residential",
  defaultGstPercent: 0,
  roundAmounts: true,
};

// ------------------------------------------------------------------ leads

export const LEAD_STATUSES = ["new", "contacted", "site_visit", "proposal_sent", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit: "Site visit",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export function leadStatusLabel(value: string | null | undefined): string {
  if (isLeadStatus(value)) return LEAD_STATUS_LABELS[value];
  if (!value) return "—";
  return value.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Website enquiries arrive with `source = "website"`. */
export const LEAD_SOURCES = ["website", "instagram", "whatsapp", "referral", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  referral: "Referral",
  other: "Other",
};

export function leadSourceLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const known = (LEAD_SOURCES as readonly string[]).includes(value) ? LEAD_SOURCE_LABELS[value as LeadSource] : null;
  return known ?? value.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** `GET /leads` / `GET /leads/:id` row. */
export type Lead = {
  id: string;
  clientName: string | null;
  clientPhone: string | null;
  /** Location / area of the site. */
  area: string | null;
  projectType: string | null;
  source: string | null;
  /** Free-form ("10-20 L"). */
  estimatedBudget: string | null;
  notes: string | null;
  status: LeadStatus | string;
  assignedManagerId: string | null;
  /** Present if the API joins the assignee's name. */
  assignedManagerName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

/** `POST /leads` / `PATCH /leads/:id` body. */
export type LeadInput = {
  clientName: string;
  clientPhone?: string | null;
  area?: string | null;
  projectType?: string | null;
  source?: string | null;
  estimatedBudget?: string | null;
  notes?: string | null;
  status?: LeadStatus;
  assignedManagerId?: string | null;
};

export type LeadPatch = Partial<LeadInput>;

// ------------------------------------------------------------------ quotes

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function quoteStatusLabel(value: string | null | undefined): string {
  if (isQuoteStatus(value)) return QUOTE_STATUS_LABELS[value];
  return value ? value.replace(/^\w/, (c) => c.toUpperCase()) : "—";
}

/** `amount` = flat ₹ off; `percent` = % of the subtotal. (Mobile wrote `flat` for amount.) */
export type DiscountType = "amount" | "percent";

export function toDiscountType(value: unknown): DiscountType {
  return value === "percent" ? "percent" : "amount";
}

/** One priced line. `amount` is a computed snapshot kept in sync by the builder. */
export type QuoteItem = {
  catalogItemId: string | null;
  name: string;
  description: string;
  itemType: CatalogItemType;
  /** "Carcass • Premium", or the brand for accessories. */
  variantLabel: string;
  /** Area basis (components). */
  lengthMm: number | null;
  heightMm: number | null;
  /** Qty / UOM basis (accessories, services). */
  qty: number | null;
  uom: string;
  rate: number;
  amount: number;
};

/** A room/area grouping (e.g. "Modular Kitchen"). `type` drives the PDF columns. */
export type QuoteSection = {
  title: string;
  type: CatalogItemType;
  items: QuoteItem[];
};

/** `GET /quotes/:id` row (list rows have the same shape). */
export type Quote = {
  id: string;
  leadId: string | null;
  /** Assigned by the server. */
  quoteNumber: string | null;
  status: QuoteStatus | string;
  preparedForName: string | null;
  preparedForPhone: string | null;
  preparedForEmail: string | null;
  preparedForAddress: string | null;
  pdfUrl: string | null;
  handledBy: string | null;
  designedBy: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  enquiryDate: string | null;
  enquiryNo: string | null;
  siteLocation: string | null;
  projectType: string | null;
  notIncluded: string[];
  sections: QuoteSection[];
  discountType: DiscountType;
  discountValue: number;
  gstPercent: number;
  /** Server-computed. */
  subtotal: number;
  grandTotal: number;
  createdAt: string;
  updatedAt: string | null;
};

/** `POST /quotes` / `PATCH /quotes/:id` body. Totals and the quote number are server-side. */
export type QuoteInput = Partial<{
  leadId: string | null;
  status: QuoteStatus;
  preparedForName: string;
  preparedForPhone: string;
  preparedForEmail: string;
  preparedForAddress: string;
  handledBy: string;
  designedBy: string;
  quoteDate: string | null;
  validUntil: string | null;
  enquiryDate: string | null;
  enquiryNo: string;
  siteLocation: string;
  projectType: string;
  notIncluded: string[];
  sections: QuoteSection[];
  discountType: DiscountType;
  discountValue: number;
  gstPercent: number;
}>;

// ------------------------------------------------------------------ normalizers

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** null for missing/blank/non-numeric; numbers (or numeric strings) otherwise. */
export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = toNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

export function normalizeVariant(raw: unknown): CatalogVariant {
  const v = isObj(raw) ? raw : {};
  const id = strOrNull(v.id);
  return { ...(id ? { id } : {}), label: str(v.label), rate: toNumber(v.rate) };
}

export function normalizeCatalogItem(raw: unknown): CatalogItem {
  const r = isObj(raw) ? raw : {};
  return {
    id: str(r.id),
    name: str(r.name),
    description: strOrNull(r.description),
    itemType: toCatalogItemType(r.itemType),
    uom: strOrNull(r.uom),
    defaultSection: strOrNull(r.defaultSection),
    variants: arr(r.variants).map(normalizeVariant),
    active: r.active !== false,
    createdAt: strOrNull(r.createdAt) ?? undefined,
  };
}

export function normalizeTemplateLine(raw: unknown): QuoteTemplateLine {
  const l = isObj(raw) ? raw : {};
  const id = strOrNull(l.id);
  return {
    ...(id ? { id } : {}),
    catalogItemId: str(l.catalogItemId),
    name: str(l.name),
    itemType: toCatalogItemType(l.itemType),
    variantLabel: str(l.variantLabel),
    defaultLengthMm: toNullableNumber(l.defaultLengthMm),
    defaultHeightMm: toNullableNumber(l.defaultHeightMm),
    defaultQty: toNullableNumber(l.defaultQty),
    uom: str(l.uom),
  };
}

export function normalizeTemplate(raw: unknown): QuoteTemplate {
  const r = isObj(raw) ? raw : {};
  return {
    id: str(r.id),
    name: str(r.name),
    sections: arr(r.sections).map((s) => {
      const sec = isObj(s) ? s : {};
      const id = strOrNull(sec.id);
      return {
        ...(id ? { id } : {}),
        title: str(sec.title),
        type: toCatalogItemType(sec.type),
        lines: arr(sec.lines).map(normalizeTemplateLine),
      };
    }),
    createdAt: strOrNull(r.createdAt) ?? undefined,
  };
}

/** Accepts `null` (no settings row yet) and fills every default. */
export function normalizeSettings(raw: unknown): QuotationSettings {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_QUOTATION_SETTINGS;
  const validity = toNullableNumber(r.quoteValidityDays);
  return {
    id: strOrNull(r.id) ?? undefined,
    companyName: str(r.companyName),
    phone: str(r.phone),
    email: str(r.email),
    address: str(r.address),
    logoUrl: str(r.logoUrl),
    watermarkLogoUrl: str(r.watermarkLogoUrl),
    coverImageUrl: str(r.coverImageUrl),
    footerText: str(r.footerText),
    defaultTerms: str(r.defaultTerms),
    defaultNotIncluded: arr(r.defaultNotIncluded).map(str).filter(Boolean),
    quoteValidityDays: validity !== null && validity >= 0 ? Math.round(validity) : d.quoteValidityDays,
    quoteNumberPrefix: str(r.quoteNumberPrefix) || d.quoteNumberPrefix,
    defaultProjectType: str(r.defaultProjectType) || d.defaultProjectType,
    defaultGstPercent: toNumber(r.defaultGstPercent),
    roundAmounts: r.roundAmounts !== false,
    updatedAt: strOrNull(r.updatedAt) ?? undefined,
  };
}

export function normalizeLead(raw: unknown): Lead {
  const r = isObj(raw) ? raw : {};
  return {
    id: str(r.id),
    clientName: strOrNull(r.clientName),
    clientPhone: strOrNull(r.clientPhone),
    area: strOrNull(r.area),
    projectType: strOrNull(r.projectType),
    source: strOrNull(r.source),
    estimatedBudget: strOrNull(r.estimatedBudget),
    notes: strOrNull(r.notes),
    status: str(r.status) || "new",
    assignedManagerId: strOrNull(r.assignedManagerId),
    assignedManagerName: strOrNull(r.assignedManagerName),
    createdAt: str(r.createdAt),
    updatedAt: strOrNull(r.updatedAt),
  };
}

export function normalizeQuoteItem(raw: unknown, sectionType?: CatalogItemType): QuoteItem {
  const i = isObj(raw) ? raw : {};
  return {
    catalogItemId: strOrNull(i.catalogItemId) || null,
    name: str(i.name),
    description: str(i.description),
    itemType: i.itemType === undefined && sectionType ? sectionType : toCatalogItemType(i.itemType),
    variantLabel: str(i.variantLabel),
    lengthMm: toNullableNumber(i.lengthMm),
    heightMm: toNullableNumber(i.heightMm),
    qty: toNullableNumber(i.qty),
    uom: str(i.uom),
    rate: toNumber(i.rate),
    amount: toNumber(i.amount),
  };
}

export function normalizeQuoteSection(raw: unknown): QuoteSection {
  const s = isObj(raw) ? raw : {};
  const type = toCatalogItemType(s.type);
  return { title: str(s.title), type, items: arr(s.items).map((i) => normalizeQuoteItem(i, type)) };
}

export function normalizeQuote(raw: unknown): Quote {
  const r = isObj(raw) ? raw : {};
  return {
    id: str(r.id),
    leadId: strOrNull(r.leadId),
    quoteNumber: strOrNull(r.quoteNumber),
    status: str(r.status) || "draft",
    preparedForName: strOrNull(r.preparedForName),
    preparedForPhone: strOrNull(r.preparedForPhone),
    preparedForEmail: strOrNull(r.preparedForEmail),
    preparedForAddress: strOrNull(r.preparedForAddress),
    pdfUrl: strOrNull(r.pdfUrl),
    handledBy: strOrNull(r.handledBy),
    designedBy: strOrNull(r.designedBy),
    // `date` is the mobile app's name for the quote date.
    quoteDate: strOrNull(r.quoteDate) ?? strOrNull(r.date),
    validUntil: strOrNull(r.validUntil),
    enquiryDate: strOrNull(r.enquiryDate),
    enquiryNo: strOrNull(r.enquiryNo),
    siteLocation: strOrNull(r.siteLocation),
    projectType: strOrNull(r.projectType),
    notIncluded: arr(r.notIncluded).map(str).filter(Boolean),
    sections: arr(r.sections).map(normalizeQuoteSection),
    discountType: toDiscountType(r.discountType),
    discountValue: toNumber(r.discountValue),
    gstPercent: toNumber(r.gstPercent),
    subtotal: toNumber(r.subtotal),
    grandTotal: toNumber(r.grandTotal),
    createdAt: str(r.createdAt),
    updatedAt: strOrNull(r.updatedAt),
  };
}

/** Lists from the API may be `null` or wrapped; always returns an array. */
export function normalizeList<T>(raw: unknown, each: (row: unknown) => T): T[] {
  if (Array.isArray(raw)) return raw.map(each);
  if (isObj(raw) && Array.isArray(raw.items)) return raw.items.map(each);
  if (isObj(raw) && Array.isArray(raw.data)) return raw.data.map(each);
  return [];
}
