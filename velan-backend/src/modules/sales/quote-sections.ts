import {
  ITEM_TYPES,
  ItemType,
  MAX_ITEMS_PER_SECTION,
  MAX_SECTIONS,
} from './sales.constants';

/**
 * Validation + normalisation for the jsonb blobs a quote / template carries.
 * The shape mirrors the mobile app's QuoteModel / QuoteTemplateModel so both
 * clients read the same rows. Unknown keys are dropped; missing strings become
 * '' and missing numbers null, so half-filled drafts (autosave) still save.
 */

export interface QuoteItemData {
  id?: string;
  catalogItemId: string | null;
  name: string;
  description: string;
  itemType: ItemType;
  variantLabel: string;
  lengthMm: number | null;
  heightMm: number | null;
  qty: number | null;
  uom: string;
  rate: number;
  amount: number;
}

export interface QuoteSectionData {
  id?: string;
  title: string;
  type: ItemType;
  items: QuoteItemData[];
}

export interface TemplateLineData {
  id?: string;
  catalogItemId: string | null;
  name: string;
  itemType: ItemType;
  variantLabel: string;
  defaultLengthMm: number | null;
  defaultHeightMm: number | null;
  defaultQty: number | null;
  uom: string;
}

export interface TemplateSectionData {
  id?: string;
  title: string;
  type: ItemType;
  lines: TemplateLineData[];
}

export interface ParseResult<T> {
  value: T;
  errors: string[];
}

const MAX_NUMBER = 1e12;

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Collects errors with a path prefix while reading one object. */
class Reader {
  constructor(
    private readonly src: Record<string, unknown>,
    private readonly path: string,
    private readonly errors: string[],
  ) {}

  str(key: string, max: number): string {
    const v = this.src[key];
    if (v === undefined || v === null) return '';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v !== 'string') {
      this.errors.push(`${this.path}.${key} must be a string`);
      return '';
    }
    if (v.length > max) this.errors.push(`${this.path}.${key} must be at most ${max} characters`);
    return v;
  }

  optId(key: string): string | undefined {
    const v = this.src[key];
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v !== 'string' || v.length > 100) {
      this.errors.push(`${this.path}.${key} must be a string of at most 100 characters`);
      return undefined;
    }
    return v;
  }

  nullableId(key: string): string | null {
    return this.optId(key) ?? null;
  }

  /** Number or numeric string; '' / null / missing -> null. */
  num(key: string, opts: { min?: number } = {}): number | null {
    const v = this.src[key];
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'string' ? Number(v.trim()) : v;
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > MAX_NUMBER) {
      this.errors.push(`${this.path}.${key} must be a number`);
      return null;
    }
    if (opts.min !== undefined && n < opts.min) {
      this.errors.push(`${this.path}.${key} must be at least ${opts.min}`);
      return null;
    }
    return n;
  }

  type(key: string, fallback: ItemType): ItemType {
    const v = this.src[key];
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v !== 'string' || !(ITEM_TYPES as readonly string[]).includes(v)) {
      this.errors.push(`${this.path}.${key} must be one of: ${ITEM_TYPES.join(', ')}`);
      return fallback;
    }
    return v as ItemType;
  }

  list(key: string, max: number): unknown[] {
    const v = this.src[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      this.errors.push(`${this.path}.${key} must be an array`);
      return [];
    }
    if (v.length > max) {
      this.errors.push(`${this.path}.${key} must have at most ${max} entries`);
      return v.slice(0, max);
    }
    return v;
  }
}

function withId<T extends object>(id: string | undefined, rest: T): T & { id?: string } {
  return id === undefined ? rest : { id, ...rest };
}

function readSections<S>(
  input: unknown,
  readOne: (src: Record<string, unknown>, path: string, errors: string[]) => S,
): ParseResult<S[]> {
  const errors: string[] = [];
  if (input === undefined || input === null) return { value: [], errors };
  if (!Array.isArray(input)) return { value: [], errors: ['sections must be an array'] };
  if (input.length > MAX_SECTIONS) {
    errors.push(`sections must have at most ${MAX_SECTIONS} entries`);
  }
  const value: S[] = [];
  input.slice(0, MAX_SECTIONS).forEach((raw, i) => {
    const path = `sections[${i}]`;
    if (!isObject(raw)) {
      errors.push(`${path} must be an object`);
      return;
    }
    value.push(readOne(raw, path, errors));
  });
  return { value, errors };
}

const SQ_MM_PER_SQ_FT = 92903.04;
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A line's amount from its own inputs, priced the way the web and mobile
 * builders do: components by face area (L × H mm → sq.ft) × rate, accessories
 * and services by qty × rate. Whole rupees when the quotation settings round
 * amounts, otherwise paise. A line missing its size/qty keeps the sent amount.
 */
export function lineAmountFor(item: QuoteItemData, roundAmounts: boolean): number {
  const rate = Math.max(0, item.rate || 0);
  let raw: number;
  if (item.itemType === 'component') {
    if (item.lengthMm == null || item.heightMm == null) return item.amount;
    raw = ((Math.max(0, item.lengthMm) * Math.max(0, item.heightMm)) / SQ_MM_PER_SQ_FT) * rate;
  } else {
    if (item.qty == null) return item.amount;
    raw = Math.max(0, item.qty) * rate;
  }
  return roundAmounts ? Math.round(raw) : round2(raw);
}

/** Sections with every line amount recomputed (the server never trusts sent amounts). */
export function withLineAmounts(sections: QuoteSectionData[], roundAmounts: boolean): QuoteSectionData[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, amount: lineAmountFor(item, roundAmounts) })),
  }));
}

/** Quote sections: [{ title, type, items: [{ name, itemType, rate, amount, … }] }]. */
export function parseQuoteSections(input: unknown): ParseResult<QuoteSectionData[]> {
  return readSections(input, (src, path, errors) => {
    const r = new Reader(src, path, errors);
    const type = r.type('type', 'component');
    const items: QuoteItemData[] = [];
    r.list('items', MAX_ITEMS_PER_SECTION).forEach((rawItem, j) => {
      const ipath = `${path}.items[${j}]`;
      if (!isObject(rawItem)) {
        errors.push(`${ipath} must be an object`);
        return;
      }
      const ir = new Reader(rawItem, ipath, errors);
      items.push(
        withId(ir.optId('id'), {
          catalogItemId: ir.nullableId('catalogItemId'),
          name: ir.str('name', 300),
          description: ir.str('description', 2000),
          itemType: ir.type('itemType', type),
          variantLabel: ir.str('variantLabel', 300),
          lengthMm: ir.num('lengthMm', { min: 0 }),
          heightMm: ir.num('heightMm', { min: 0 }),
          qty: ir.num('qty', { min: 0 }),
          uom: ir.str('uom', 40),
          rate: ir.num('rate', { min: 0 }) ?? 0,
          amount: ir.num('amount') ?? 0,
        }),
      );
    });
    return withId(r.optId('id'), { title: r.str('title', 300), type, items });
  });
}

/** Template sections: [{ title, type, lines: [{ catalogItemId, name, defaultQty, … }] }]. */
export function parseTemplateSections(input: unknown): ParseResult<TemplateSectionData[]> {
  return readSections(input, (src, path, errors) => {
    const r = new Reader(src, path, errors);
    const type = r.type('type', 'component');
    const lines: TemplateLineData[] = [];
    r.list('lines', MAX_ITEMS_PER_SECTION).forEach((rawLine, j) => {
      const lpath = `${path}.lines[${j}]`;
      if (!isObject(rawLine)) {
        errors.push(`${lpath} must be an object`);
        return;
      }
      const lr = new Reader(rawLine, lpath, errors);
      lines.push(
        withId(lr.optId('id'), {
          catalogItemId: lr.nullableId('catalogItemId'),
          name: lr.str('name', 300),
          itemType: lr.type('itemType', type),
          variantLabel: lr.str('variantLabel', 300),
          defaultLengthMm: lr.num('defaultLengthMm', { min: 0 }),
          defaultHeightMm: lr.num('defaultHeightMm', { min: 0 }),
          defaultQty: lr.num('defaultQty', { min: 0 }),
          uom: lr.str('uom', 40),
        }),
      );
    });
    return withId(r.optId('id'), { title: r.str('title', 300), type, lines });
  });
}

/** First few errors as one message (for 400 responses). */
export function summarizeErrors(errors: string[], max = 5): string {
  const head = errors.slice(0, max).join('; ');
  return errors.length > max ? `${head}; …and ${errors.length - max} more` : head;
}
