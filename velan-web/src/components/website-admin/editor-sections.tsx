"use client";

import { Wand2 } from "lucide-react";
import { useMemo } from "react";
import { Controller, useWatch, type UseFormRegisterReturn, type UseFormReturn } from "react-hook-form";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DESCRIPTION_MAX, PORTFOLIO_CATEGORIES, PORTFOLIO_STATUSES } from "@/lib/api/portfolio-admin";
import { cn } from "@/lib/utils";
import type { PortfolioFormValues } from "./portfolio-form";
import { CATEGORY_LABELS, STATUS_DESCRIPTIONS, STATUS_LABELS } from "./portfolio-rules";
import type { ProjectOption } from "./use-portfolio";

type Form = UseFormReturn<PortfolioFormValues>;

const CATEGORY_ITEMS = PORTFOLIO_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));
const NO_PROJECT = "__none__";

function SectionTitle({ children }: { children: string }) {
  return (
    <CardTitle>
      <h2>{children}</h2>
    </CardTitle>
  );
}

/** Title, web address, category, year, location and description. */
export function DetailsSection({
  form,
  titleField,
  slugField,
  slugHint,
  onSlugFromTitle,
}: {
  form: Form;
  titleField: UseFormRegisterReturn<"title">;
  slugField: UseFormRegisterReturn<"slug">;
  slugHint: string;
  /** Edit mode only: regenerate the address from the current title. */
  onSlugFromTitle?: () => void;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const description = useWatch({ control, name: "description" });

  return (
    <Card>
      <CardHeader>
        <SectionTitle>Details</SectionTitle>
        <CardDescription>What visitors read on the project page.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormField id="title" label="Title" error={errors.title?.message}>
          <Input
            autoComplete="off"
            placeholder="e.g. Modern villa, Adyar"
            className="h-9"
            {...fieldAria("title", errors.title?.message)}
            {...titleField}
          />
        </FormField>

        <FormField id="slug" label="Web address" error={errors.slug?.message} hint={slugHint}>
          <InputGroup className="h-9">
            <InputGroupAddon>
              <InputGroupText>/portfolio/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="modern-villa-adyar"
              {...fieldAria("slug", errors.slug?.message, "hint")}
              {...slugField}
            />
            {onSlugFromTitle && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="xs" onClick={onSlugFromTitle}>
                  <Wand2 aria-hidden />
                  From title
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="category" label="Category" error={errors.category?.message}>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  items={CATEGORY_ITEMS}
                  value={field.value}
                  onValueChange={(v) => {
                    if (v) field.onChange(v);
                  }}
                >
                  <SelectTrigger id="category" className="h-9 w-full" onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CATEGORY_ITEMS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField id="completionYear" label="Completion year (optional)" error={errors.completionYear?.message}>
            <Input
              inputMode="numeric"
              maxLength={4}
              placeholder="2024"
              autoComplete="off"
              className="h-9"
              {...fieldAria("completionYear", errors.completionYear?.message)}
              {...register("completionYear")}
            />
          </FormField>
        </div>

        <FormField id="location" label="Location (optional)" error={errors.location?.message}>
          <Input
            placeholder="e.g. Adyar, Chennai"
            autoComplete="off"
            className="h-9"
            {...fieldAria("location", errors.location?.message)}
            {...register("location")}
          />
        </FormField>

        <FormField
          id="description"
          label="Description (optional)"
          error={errors.description?.message}
          hint={`${description.trim().length} of ${DESCRIPTION_MAX} characters. Line breaks are kept.`}
        >
          <Textarea
            rows={6}
            placeholder="The brief, what we did, materials and finishes…"
            {...fieldAria("description", errors.description?.message, "hint")}
            {...register("description")}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}

/** Photos card wrapper (the manager itself lives in image-manager.tsx). */
export function PhotosSection({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <SectionTitle>Photos</SectionTitle>
        <CardDescription>Uploaded straight to the website&apos;s photo storage.</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Status (draft / published / hidden) and the optional internal project link. */
export function PublishingSection({
  form,
  projects,
  savedProjectId,
  hasPhotos,
}: {
  form: Form;
  /** null = the projects list couldn't be loaded. */
  projects: ProjectOption[] | null;
  savedProjectId: string | null;
  hasPhotos: boolean;
}) {
  const { control, register } = form;
  const status = useWatch({ control, name: "status" });

  const projectItems = useMemo(() => {
    const options = [{ value: NO_PROJECT, label: "No linked project" }];
    for (const p of projects ?? []) options.push({ value: p.id, label: `${p.projectName} · ${p.projectCode}` });
    if (savedProjectId && !options.some((o) => o.value === savedProjectId)) {
      options.push({ value: savedProjectId, label: "Linked project (not in your list)" });
    }
    return options;
  }, [projects, savedProjectId]);

  return (
    <Card>
      <CardHeader>
        <SectionTitle>Publishing</SectionTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-ink">Status</legend>
          {PORTFOLIO_STATUSES.map((s) => (
            <label
              key={s}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40",
                "has-checked:bg-gold/10 has-checked:ring-2 has-checked:ring-gold has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              )}
            >
              <input type="radio" value={s} className="mt-0.5 size-4 accent-ink" {...register("status")} />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-ink">{STATUS_LABELS[s]}</span>
                <span className="text-xs text-muted-foreground">{STATUS_DESCRIPTIONS[s]}</span>
              </span>
            </label>
          ))}
          {status === "published" && !hasPhotos && (
            <p className="text-xs text-warning">Add at least one photo — without one the website shows a placeholder.</p>
          )}
        </fieldset>

        <FormField
          id="projectId"
          label="Linked project (optional)"
          hint={
            projects === null
              ? "Couldn't load your projects. The current link is kept."
              : "For your reference only. Never shown on the website."
          }
        >
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <Select
                items={projectItems}
                value={field.value || NO_PROJECT}
                disabled={projects === null}
                onValueChange={(v) => field.onChange(typeof v === "string" && v !== NO_PROJECT ? v : "")}
              >
                <SelectTrigger id="projectId" aria-describedby="projectId-hint" className="h-9 w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {projectItems.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}
