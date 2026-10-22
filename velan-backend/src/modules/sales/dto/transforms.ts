import { TransformFnParams } from 'class-transformer';
import { ValidateBy, ValidateIf, ValidationOptions } from 'class-validator';
import { parseQuoteSections, parseTemplateSections, summarizeErrors } from '../quote-sections';

export const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

/** Nullable text column: trimmed, '' -> null (clears the column). */
export const trimOrNull = ({ value }: TransformFnParams) => {
  const v = trim({ value } as TransformFnParams);
  return v === '' ? null : v;
};

/** NOT NULL text column a form may send blank: '' -> undefined (left unchanged). */
export const trimOrUndefined = ({ value }: TransformFnParams) => {
  const v = trim({ value } as TransformFnParams);
  return v === '' ? undefined : v;
};

/** Free-form text column that clients may send as a number (e.g. a budget). */
export const textOrNull = ({ value }: TransformFnParams) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : trimOrNull({ value } as TransformFnParams);

/** Trim each entry of a string array and drop blanks. */
export const trimList = ({ value }: TransformFnParams) =>
  Array.isArray(value)
    ? value
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v) => v !== '')
    : value;

/**
 * Optional, but NOT nullable: skips validation only when the key is absent, so
 * an explicit null for a NOT NULL column fails with 400 instead of a DB error.
 */
export const OptionalNotNull = () => ValidateIf((_o: object, v: unknown) => v !== undefined);

function sectionsValidator(
  name: string,
  parse: (v: unknown) => { errors: string[] },
  options?: ValidationOptions,
) {
  return ValidateBy(
    {
      name,
      validator: {
        validate: (v: unknown) => parse(v).errors.length === 0,
        defaultMessage: (args) => summarizeErrors(parse(args?.value).errors),
      },
    },
    options,
  );
}

/** Quote `sections` jsonb (see quote-sections.ts for the shape). */
export const IsQuoteSections = (options?: ValidationOptions) =>
  sectionsValidator('isQuoteSections', parseQuoteSections, options);

/** Template `sections` jsonb (see quote-sections.ts for the shape). */
export const IsTemplateSections = (options?: ValidationOptions) =>
  sectionsValidator('isTemplateSections', parseTemplateSections, options);
