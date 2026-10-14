import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  CreatePortfolioDto,
  EnquiryDto,
  ReorderPortfolioDto,
  SignPortfolioUploadDto,
  UpdatePortfolioDto,
} from './dto';

/** Same options as the global ValidationPipe in main.ts. */
async function check<T extends object>(cls: new () => T, body: unknown) {
  const instance = plainToInstance(cls, body);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  return { instance, errors, fields: errors.map((e: ValidationError) => e.property) };
}

const UUID_A = '6f1c2f5e-3c1b-4d55-9a31-0d9f1f0b7a11';
const UUID_B = '0d9f1f0b-7a11-4d55-9a31-6f1c2f5e3c1b';

describe('EnquiryDto', () => {
  const valid = {
    name: '  Asha   Raman ',
    phone: '98765 43210',
    email: 'asha@example.com',
    location: 'Adyar,\nChennai',
    projectType: 'Residential',
    budgetRange: '10-20 L',
    message: 'Full 3BHK\r\ninterior',
  };

  it('accepts a normal enquiry and normalises name, phone and text', async () => {
    const { instance, errors } = await check(EnquiryDto, valid);
    expect(errors).toEqual([]);
    expect(instance.name).toBe('Asha Raman');
    expect(instance.phone).toBe('+919876543210');
    expect(instance.location).toBe('Adyar, Chennai');
    expect(instance.message).toBe('Full 3BHK\ninterior');
  });

  it('accepts international numbers as-is', async () => {
    const { instance, errors } = await check(EnquiryDto, { ...valid, phone: '+1 (555) 123-4567' });
    expect(errors).toEqual([]);
    expect(instance.phone).toBe('+15551234567');
  });

  it('treats empty optional strings (as sent by HTML forms) as absent', async () => {
    const { instance, errors } = await check(EnquiryDto, {
      name: 'Asha',
      phone: '9876543210',
      email: '',
      location: ' ',
      projectType: '',
      budgetRange: '',
      message: '',
      company: '',
    });
    expect(errors).toEqual([]);
    expect(instance.email).toBeUndefined();
    expect(instance.location).toBeUndefined();
    expect(instance.message).toBeUndefined();
  });

  it.each([
    ['+911234567890', '+91 number that is not a mobile'],
    ['12345', 'too short'],
    ['abc', 'not a number'],
    ['', 'empty'],
  ])('rejects phone %j (%s)', async (phone) => {
    const { fields } = await check(EnquiryDto, { ...valid, phone });
    expect(fields).toContain('phone');
  });

  it('requires name and phone', async () => {
    const { fields } = await check(EnquiryDto, {});
    expect(fields).toEqual(expect.arrayContaining(['name', 'phone']));
  });

  it.each([
    ['name', 'A'],
    ['name', 'x'.repeat(81)],
    ['email', 'not-an-email'],
    ['location', 'x'.repeat(121)],
    ['projectType', 'x'.repeat(61)],
    ['budgetRange', 'x'.repeat(41)],
    ['message', 'x'.repeat(2001)],
  ])('rejects invalid %s', async (field, value) => {
    const { fields } = await check(EnquiryDto, { ...valid, [field]: value });
    expect(fields).toContain(field);
  });

  it('rejects unknown properties (whitelist)', async () => {
    const { fields } = await check(EnquiryDto, { ...valid, status: 'won' });
    expect(fields).toContain('status');
  });

  it('skips field validation when the honeypot is filled (bot gets a silent 201)', async () => {
    const { errors, instance } = await check(EnquiryDto, {
      name: '',
      phone: 'spam',
      email: 'nope',
      company: 'Spam Inc',
    });
    expect(errors).toEqual([]);
    expect(instance.company).toBe('Spam Inc');
  });
});

describe('CreatePortfolioDto', () => {
  it('requires a title', async () => {
    const { fields } = await check(CreatePortfolioDto, {});
    expect(fields).toEqual(['title']);
  });

  it('accepts a full item and trims text', async () => {
    const { errors, instance } = await check(CreatePortfolioDto, {
      title: '  Modern Villa ',
      slug: 'modern-villa',
      description: 'Open plan',
      category: 'residential',
      location: 'Chennai',
      completionYear: 2024,
      coverImageUrl: 'https://abc.supabase.co/storage/v1/object/public/portfolio/items/a/c.jpg',
      imageUrls: ['https://abc.supabase.co/storage/v1/object/public/portfolio/items/a/1.jpg'],
      status: 'published',
      sortOrder: 2,
      projectId: UUID_A,
    });
    expect(errors).toEqual([]);
    expect(instance.title).toBe('Modern Villa');
  });

  it.each([
    ['slug', 'Has Spaces'],
    ['slug', 'trailing-'],
    ['slug', 'double--dash'],
    ['category', 'villa'],
    ['status', 'archived'],
    ['completionYear', 1989],
    ['completionYear', 2101],
    ['completionYear', 2020.5],
    ['sortOrder', -1],
    ['projectId', 'not-a-uuid'],
    ['imageUrls', 'https://x'],
    ['imageUrls', Array.from({ length: 41 }, (_, i) => `https://x/${i}.jpg`)],
    ['title', 'x'.repeat(121)],
    ['description', 'x'.repeat(5001)],
  ])('rejects invalid %s', async (field, value) => {
    const { fields } = await check(CreatePortfolioDto, { title: 'Villa', [field]: value });
    expect(fields).toContain(field);
  });

  it('rejects null for columns that cannot be null', async () => {
    for (const field of ['category', 'status', 'sortOrder', 'imageUrls', 'slug']) {
      const { fields } = await check(CreatePortfolioDto, { title: 'Villa', [field]: null });
      expect(fields).toContain(field);
    }
  });
});

describe('UpdatePortfolioDto', () => {
  it('accepts an empty patch', async () => {
    expect((await check(UpdatePortfolioDto, {})).errors).toEqual([]);
  });

  it('allows clearing nullable fields with null', async () => {
    const { errors } = await check(UpdatePortfolioDto, {
      description: null,
      location: null,
      completionYear: null,
      coverImageUrl: null,
      projectId: null,
    });
    expect(errors).toEqual([]);
  });

  it('turns blank nullable strings into null', async () => {
    const { instance } = await check(UpdatePortfolioDto, { description: '   ', location: '' });
    expect(instance.description).toBeNull();
    expect(instance.location).toBeNull();
  });

  it('rejects null for title and other required columns', async () => {
    for (const field of ['title', 'category', 'status', 'sortOrder', 'imageUrls', 'slug']) {
      const { fields } = await check(UpdatePortfolioDto, { [field]: null });
      expect(fields).toContain(field);
    }
  });
});

describe('ReorderPortfolioDto', () => {
  it('accepts a list of unique uuids', async () => {
    expect((await check(ReorderPortfolioDto, { ids: [UUID_A, UUID_B] })).errors).toEqual([]);
  });

  it.each([
    ['duplicates', [UUID_A, UUID_A]],
    ['non-uuid', ['abc']],
    ['empty list', []],
    ['not an array', UUID_A],
    ['over 500 ids', Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)],
  ])('rejects %s', async (_label, ids) => {
    expect((await check(ReorderPortfolioDto, { ids })).fields).toContain('ids');
  });
});

describe('SignPortfolioUploadDto', () => {
  const ok = { fileName: 'Living Room.jpg', contentType: 'image/jpeg', size: 1024 };

  it('accepts an image within the size limit', async () => {
    expect((await check(SignPortfolioUploadDto, ok)).errors).toEqual([]);
    expect(
      (await check(SignPortfolioUploadDto, { ...ok, size: 10 * 1024 * 1024 })).errors,
    ).toEqual([]);
  });

  it.each([
    ['contentType', 'image/svg+xml'],
    ['contentType', 'image/gif'],
    ['contentType', 'text/html'],
    ['size', 10 * 1024 * 1024 + 1],
    ['size', 0],
    ['size', 1.5],
    ['fileName', ''],
    ['fileName', 'x'.repeat(256)],
  ])('rejects invalid %s %j', async (field, value) => {
    expect((await check(SignPortfolioUploadDto, { ...ok, [field]: value })).fields).toContain(field);
  });
});
