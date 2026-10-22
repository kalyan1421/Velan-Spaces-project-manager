/**
 * Editor form model: zod schema (string inputs, validated like the API's DTO),
 * defaults from an item, and the create / PATCH bodies.
 */

import { z } from "zod";
import {
  DESCRIPTION_MAX,
  LOCATION_MAX,
  MAX_PORTFOLIO_IMAGES,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_STATUSES,
  TITLE_MAX,
  TITLE_MIN,
  YEAR_MAX,
  YEAR_MIN,
  type PortfolioCreateBody,
  type PortfolioUpdateBody,
} from "@/lib/api/portfolio-admin";
import type { PortfolioCategory, PortfolioItem, PortfolioStatus } from "@/lib/api/types";
import { validateSlug } from "./portfolio-rules";

export type PortfolioFormValues = {
  title: string;
  slug: string;
  category: PortfolioCategory;
  location: string;
  /** Text input; "" = not set. */
  completionYear: string;
  description: string;
  status: PortfolioStatus;
  /** "" = no linked project. */
  projectId: string;
  coverImageUrl: string | null;
  imageUrls: string[];
};

const YEAR_RE = /^\d{4}$/;

export function makePortfolioFormSchema({ mode, takenSlugs }: { mode: "create" | "edit"; takenSlugs: readonly string[] }) {
  const taken = new Set(takenSlugs);
  return z.object({
    title: z
      .string()
      .refine((v) => v.trim().length >= TITLE_MIN, `Use at least ${TITLE_MIN} characters.`)
      .refine((v) => v.trim().length <= TITLE_MAX, `Use at most ${TITLE_MAX} characters.`),
    slug: z.string().superRefine((raw, ctx) => {
      const slug = raw.trim();
      if (slug === "" && mode === "create") return;
      const error = validateSlug(slug);
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      else if (taken.has(slug)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "This web address is already used by another project." });
      }
    }),
    category: z.enum(PORTFOLIO_CATEGORIES),
    location: z.string().refine((v) => v.trim().length <= LOCATION_MAX, `Use at most ${LOCATION_MAX} characters.`),
    completionYear: z.string().superRefine((raw, ctx) => {
      const v = raw.trim();
      if (v === "") return;
      if (!YEAR_RE.test(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a year like 2024." });
        return;
      }
      const year = Number(v);
      if (year < YEAR_MIN || year > YEAR_MAX) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter a year between ${YEAR_MIN} and ${YEAR_MAX}.` });
      }
    }),
    description: z
      .string()
      .refine((v) => v.trim().length <= DESCRIPTION_MAX, `Use at most ${DESCRIPTION_MAX} characters.`),
    status: z.enum(PORTFOLIO_STATUSES),
    projectId: z.string(),
    coverImageUrl: z.string().nullable(),
    imageUrls: z
      .array(z.string())
      .max(MAX_PORTFOLIO_IMAGES, `A project can have at most ${MAX_PORTFOLIO_IMAGES} photos.`)
      .refine((urls) => new Set(urls).size === urls.length, "The same photo is in the gallery twice."),
  }) satisfies z.ZodType<PortfolioFormValues>;
}

export function toFormValues(item?: PortfolioItem): PortfolioFormValues {
  return {
    title: item?.title ?? "",
    slug: item?.slug ?? "",
    category: item?.category ?? "residential",
    location: item?.location ?? "",
    completionYear: item?.completionYear != null ? String(item.completionYear) : "",
    description: item?.description ?? "",
    status: item?.status ?? "draft",
    projectId: item?.projectId ?? "",
    coverImageUrl: item?.coverImageUrl ?? null,
    imageUrls: item?.imageUrls ? [...item.imageUrls] : [],
  };
}

const textOrNull = (v: string) => (v.trim() === "" ? null : v.trim());
const yearOrNull = (v: string) => (v.trim() === "" ? null : Number(v.trim()));
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * POST body. Empty optional fields are omitted; the slug is sent only when the
 * user edited it (otherwise the API generates a unique one from the title).
 */
export function buildCreateBody(values: PortfolioFormValues, { slugEdited }: { slugEdited: boolean }): PortfolioCreateBody {
  const body: PortfolioCreateBody = {
    title: values.title.trim(),
    category: values.category,
    status: values.status,
    imageUrls: [...values.imageUrls],
  };
  const slug = values.slug.trim();
  if (slugEdited && slug) body.slug = slug;
  const location = textOrNull(values.location);
  if (location) body.location = location;
  const year = yearOrNull(values.completionYear);
  if (year !== null) body.completionYear = year;
  const description = textOrNull(values.description);
  if (description) body.description = description;
  if (values.coverImageUrl) body.coverImageUrl = values.coverImageUrl;
  if (values.projectId) body.projectId = values.projectId;
  return body;
}

/** PATCH body with only the fields that differ from `original` (`null` clears). */
export function buildUpdateBody(original: PortfolioItem, values: PortfolioFormValues): PortfolioUpdateBody {
  const body: PortfolioUpdateBody = {};

  const title = values.title.trim();
  if (title !== original.title) body.title = title;
  const slug = values.slug.trim();
  if (slug !== original.slug) body.slug = slug;
  if (values.category !== original.category) body.category = values.category;
  if (values.status !== original.status) body.status = values.status;

  const location = textOrNull(values.location);
  if (location !== (original.location ?? null)) body.location = location;
  const year = yearOrNull(values.completionYear);
  if (year !== (original.completionYear ?? null)) body.completionYear = year;
  const description = textOrNull(values.description);
  if (description !== (original.description ?? null)) body.description = description;
  const projectId = values.projectId || null;
  if (projectId !== (original.projectId ?? null)) body.projectId = projectId;
  if ((values.coverImageUrl ?? null) !== (original.coverImageUrl ?? null)) body.coverImageUrl = values.coverImageUrl ?? null;
  if (!sameList(values.imageUrls, original.imageUrls)) body.imageUrls = [...values.imageUrls];

  return body;
}
