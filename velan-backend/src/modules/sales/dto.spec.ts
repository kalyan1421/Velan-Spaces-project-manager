import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import {
  CreateCatalogItemDto,
  CreateQuoteTemplateDto,
  QuotationSettingsDto,
  UpdateCatalogItemDto,
} from './dto/rate-card.dto';

/** Same options as the global ValidationPipe in main.ts. */
async function check<T extends object>(cls: new () => T, body: unknown) {
  const instance = plainToInstance(cls, body);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  const messages = errors.flatMap((e: ValidationError) => Object.values(e.constraints ?? {}));
  return { instance, errors, fields: errors.map((e) => e.property), messages };
}

const UUID = '6f1c2f5e-3c1b-4d55-9a31-0d9f1f0b7a11';

describe('Lead DTOs', () => {
  it('accepts a mobile-style lead and normalises blanks', async () => {
    const { instance, errors } = await check(CreateLeadDto, {
      clientName: '  Asha ',
      clientPhone: '',
      area: 'Adyar',
      source: 'referral',
      estimatedBudget: 1500000,
      assignedManagerId: '',
      status: 'site_visit',
    });
    expect(errors).toEqual([]);
    expect(instance.clientName).toBe('Asha');
    expect(instance.clientPhone).toBeNull();
    expect(instance.estimatedBudget).toBe('1500000');
    expect(instance.assignedManagerId).toBeNull();
  });

  it('requires clientName on create only', async () => {
    expect((await check(CreateLeadDto, {})).fields).toContain('clientName');
    expect((await check(UpdateLeadDto, { status: 'won' })).errors).toEqual([]);
  });

  it.each([['qualified'], [null]])('rejects status %j', async (status) => {
    expect((await check(UpdateLeadDto, { status })).fields).toContain('status');
  });

  it('rejects unknown fields and bad manager ids', async () => {
    const { fields } = await check(UpdateLeadDto, { assignedManagerId: 'abc', foo: 1 });
    expect(fields).toEqual(expect.arrayContaining(['assignedManagerId', 'foo']));
  });
});

describe('Quote DTOs', () => {
  const sections = [
    {
      title: 'Kitchen',
      type: 'component',
      items: [{ name: 'Base unit', itemType: 'component', lengthMm: '2400', heightMm: 900, rate: 1450, amount: 33717 }],
    },
  ];

  it('accepts a full quote and ignores server-owned fields', async () => {
    const { errors } = await check(CreateQuoteDto, {
      leadId: UUID,
      status: 'draft',
      preparedForName: 'Asha',
      quoteDate: '2026-10-22',
      validUntil: '2026-11-06T00:00:00.000Z',
      notIncluded: ['Civil work', '  '],
      sections,
      discountType: 'flat',
      discountValue: 500,
      gstPercent: 18,
      // echoed back from a GET: accepted, ignored by the service
      id: UUID,
      quoteNumber: 'HACKED-1',
      subtotal: 1,
      grandTotal: 1,
      createdAt: 'x',
      updatedAt: 'x',
    });
    expect(errors).toEqual([]);
  });

  it('treats a blank projectType as absent (draft autosave)', async () => {
    const { instance, errors } = await check(UpdateQuoteDto, { projectType: '  ' });
    expect(errors).toEqual([]);
    expect(instance.projectType).toBeUndefined();
  });

  it('rejects a percent discount over 100 but allows large flat amounts', async () => {
    expect((await check(UpdateQuoteDto, { discountType: 'percent', discountValue: 120 })).fields).toEqual([
      'discountValue',
    ]);
    expect((await check(UpdateQuoteDto, { discountType: 'amount', discountValue: 120 })).errors).toEqual([]);
  });

  it.each([
    [{ status: 'approved' }, 'status'],
    [{ gstPercent: 101 }, 'gstPercent'],
    [{ discountValue: -1 }, 'discountValue'],
    [{ discountType: 'bogus' }, 'discountType'],
    [{ quoteDate: 'yesterday' }, 'quoteDate'],
    [{ leadId: 'nope' }, 'leadId'],
    [{ projectType: null }, 'projectType'],
    [{ sections: 'x' }, 'sections'],
  ])('rejects %j', async (body, field) => {
    expect((await check(UpdateQuoteDto, body)).fields).toContain(field);
  });

  it('reports the path of a bad line item', async () => {
    const { fields, messages } = await check(UpdateQuoteDto, {
      sections: [{ title: 'K', type: 'component', items: [{ name: 'x', rate: 'abc' }, { name: 'y', itemType: 'sofa' }] }],
    });
    expect(fields).toEqual(['sections']);
    expect(messages[0]).toContain('sections[0].items[0].rate must be a number');
    expect(messages[0]).toContain('sections[0].items[1].itemType must be one of');
  });
});

describe('Rate card DTOs', () => {
  it('validates catalog items and nested variants', async () => {
    expect(
      (
        await check(CreateCatalogItemDto, {
          name: 'Base Unit',
          itemType: 'component',
          variants: [{ label: 'Premium', rate: 1450 }],
        })
      ).errors,
    ).toEqual([]);
    const bad = await check(CreateCatalogItemDto, {
      name: '',
      itemType: 'chair',
      variants: [{ label: 'x', rate: -5, extra: true }],
    });
    expect(bad.fields).toEqual(expect.arrayContaining(['name', 'itemType', 'variants']));
    expect((await check(UpdateCatalogItemDto, { active: 'no' })).fields).toEqual(['active']);
  });

  it('validates template sections', async () => {
    expect(
      (
        await check(CreateQuoteTemplateDto, {
          name: 'Standard 3BHK',
          sections: [{ title: 'Kitchen', type: 'component', lines: [{ catalogItemId: UUID, defaultQty: 2 }] }],
        })
      ).errors,
    ).toEqual([]);
    expect(
      (await check(CreateQuoteTemplateDto, { name: 'T', sections: [{ lines: [{ defaultQty: -1 }] }] })).fields,
    ).toEqual(['sections']);
  });
});

describe('QuotationSettingsDto', () => {
  it('accepts a partial update and clears blank text', async () => {
    const { instance, errors } = await check(QuotationSettingsDto, {
      companyName: 'Velan Spaces',
      email: '',
      logoUrl: 'sb://quotations/quotation/settings/logo.png',
      defaultNotIncluded: ['Civil work'],
      quoteValidityDays: 30,
      quoteNumberPrefix: 'VS-',
      defaultGstPercent: 18,
      roundAmounts: false,
      id: UUID,
      updatedAt: 'x',
    });
    expect(errors).toEqual([]);
    expect(instance.email).toBeNull();
  });

  it.each([
    [{ quoteNumberPrefix: 'Q/1' }, 'quoteNumberPrefix'],
    [{ quoteNumberPrefix: '-Q' }, 'quoteNumberPrefix'],
    [{ quoteValidityDays: 0 }, 'quoteValidityDays'],
    [{ quoteValidityDays: 2.5 }, 'quoteValidityDays'],
    [{ defaultGstPercent: 150 }, 'defaultGstPercent'],
    [{ email: 'not-an-email' }, 'email'],
    [{ roundAmounts: null }, 'roundAmounts'],
    [{ watermark: 'x' }, 'watermark'],
  ])('rejects %j', async (body, field) => {
    expect((await check(QuotationSettingsDto, body)).fields).toContain(field);
  });
});
