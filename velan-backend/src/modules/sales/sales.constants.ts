/** Lead pipeline stages (same values and order as the mobile Sales screen). */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'site_visit',
  'proposal_sent',
  'won',
  'lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Quote workflow: draft -> sent -> accepted | rejected (any move is allowed). */
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Catalog item / quote section kinds; drive the PDF columns and pricing basis. */
export const ITEM_TYPES = ['component', 'accessory', 'service'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** 'flat' is the mobile app's name for 'amount'; it is stored as 'amount'. */
export const DISCOUNT_TYPES = ['amount', 'percent', 'flat'] as const;
export type DiscountTypeInput = (typeof DISCOUNT_TYPES)[number];

/** Storage bucket for quotation files (PDFs, logo, watermark, cover image). */
export const QUOTATION_BUCKET = 'quotations';

export const DEFAULT_QUOTE_PREFIX = 'QUO-';
export const DEFAULT_VALIDITY_DAYS = 15;
export const DEFAULT_PROJECT_TYPE = 'Residential';

/** Business time zone: quote years and PDF dates are computed in IST. */
export const SALES_TIME_ZONE = 'Asia/Kolkata';

// Size limits for the jsonb blobs (sections / variants).
export const MAX_SECTIONS = 100;
export const MAX_ITEMS_PER_SECTION = 300;
export const MAX_VARIANTS = 50;
export const MAX_NOT_INCLUDED = 50;
