"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RotateCcw, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { PageHeader } from "@/components/app-shell/page-header";
import { StateMessage } from "@/components/app-shell/states";
import { useUnsavedChangesGuard } from "@/components/website-admin/unsaved-changes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import type { QuotationSettings } from "@/lib/api/sales-types";
import { BrandingImageField } from "./branding-image-field";
import { NotIncludedEditor } from "./not-included-editor";
import { errorMessage, useQuotationSettings, useSaveSettings } from "./queries";
import { SettingsSkeleton } from "./sales-admin-skeleton";
import {
  NO_IMAGE_CHANGES,
  PROJECT_TYPE_SUGGESTIONS,
  SETTINGS_LIMITS,
  hasImageChanges,
  quoteNumberExample,
  settingsFormDefaults,
  settingsFormSchema,
  toSettingsBody,
  type ImageChange,
  type ImageChanges,
  type ImageKey,
  type SettingsFormValues,
} from "./settings-schema";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

const header = (
  <PageHeader
    title="Quotation settings"
    description="Company details, branding and defaults used on every new quote and its PDF."
  />
);

/** Head only: branding and defaults for quotes. Loads, then hands a settled value to the form. */
export function QuotationSettingsPage({ initialSettings }: { initialSettings?: QuotationSettings }) {
  const query = useQuotationSettings(initialSettings);

  if (query.isPending) return <SettingsSkeleton />;
  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <StateMessage
          icon={TriangleAlert}
          tone="warning"
          title="Couldn't load the quotation settings"
          description={errorMessage(query.error)}
          action={
            <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
              Try again
            </Button>
          }
        />
      </div>
    );
  }
  return <SettingsForm saved={query.data} />;
}

function SettingsForm({ saved: initial }: { saved: QuotationSettings }) {
  const id = useId();
  const save = useSaveSettings();
  // The last saved settings: image changes and "dirty" are relative to it.
  const [saved, setSaved] = useState(initial);
  const [images, setImages] = useState<ImageChanges>(NO_IMAGE_CHANGES);
  const [uploads, setUploads] = useState(0);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settingsFormDefaults(initial),
    mode: "onTouched",
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty, isSubmitting },
  } = form;

  const [prefix, terms] = useWatch({ control, name: ["quoteNumberPrefix", "defaultTerms"] });
  const year = useMemo(() => new Date().getFullYear(), []);
  const imagesDirty = hasImageChanges(images, saved);
  const uploading = uploads > 0;
  const dirty = isDirty || imagesDirty;
  const busy = isSubmitting;

  useUnsavedChangesGuard(dirty || uploading);

  const setImage = useCallback((key: ImageKey, change: ImageChange) => setImages((c) => ({ ...c, [key]: change })), []);
  const trackUpload = useCallback((on: boolean) => setUploads((n) => Math.max(0, n + (on ? 1 : -1))), []);

  const onSubmit = handleSubmit(
    async (values) => {
      setServerErrors([]);
      if (uploading) {
        toast.error("Wait for the images to finish uploading.");
        return;
      }
      try {
        const next = await save.mutateAsync(toSettingsBody(values, images, saved));
        setSaved(next);
        setImages(NO_IMAGE_CHANGES);
        reset(settingsFormDefaults(next));
        toast.success("Quotation settings saved. New quotes will use them.");
      } catch (error) {
        setServerErrors(isApiError(error) ? error.messages : ["Something went wrong. Please try again."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    () => toast.error("Fix the highlighted fields before saving."),
  );

  const discard = () => {
    if (!window.confirm("Discard your unsaved changes?")) return;
    reset(settingsFormDefaults(saved));
    setImages(NO_IMAGE_CHANGES);
    setServerErrors([]);
  };

  const f = (name: string) => `${id}-${name}`;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 pb-24">
      {header}

      {serverErrors.length > 0 && (
        <Alert variant="destructive" aria-live="assertive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Couldn&apos;t save the settings</AlertTitle>
          <AlertDescription>
            {serverErrors.length === 1 ? (
              serverErrors[0]
            ) : (
              <ul className="list-disc pl-4">
                {serverErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Company" description="Shown in the quote header and the PDF footer.">
          <FormField id={f("company")} label="Company name" error={errors.companyName?.message}>
            <Input
              autoComplete="organization"
              className="h-9"
              disabled={busy}
              {...fieldAria(f("company"), errors.companyName?.message)}
              {...register("companyName")}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={f("phone")} label="Phone (optional)" error={errors.phone?.message}>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="h-9"
                disabled={busy}
                {...fieldAria(f("phone"), errors.phone?.message)}
                {...register("phone")}
              />
            </FormField>
            <FormField id={f("email")} label="Email (optional)" error={errors.email?.message}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                className="h-9"
                disabled={busy}
                {...fieldAria(f("email"), errors.email?.message)}
                {...register("email")}
              />
            </FormField>
          </div>
          <FormField id={f("address")} label="Address (optional)" error={errors.address?.message}>
            <Textarea
              rows={3}
              autoComplete="street-address"
              disabled={busy}
              {...fieldAria(f("address"), errors.address?.message)}
              {...register("address")}
            />
          </FormField>
          <FormField
            id={f("footer")}
            label="Footer line (optional)"
            error={errors.footerText?.message}
            hint="Printed at the bottom of every PDF page, e.g. a tagline or GSTIN."
          >
            <Input
              autoComplete="off"
              className="h-9"
              disabled={busy}
              {...fieldAria(f("footer"), errors.footerText?.message, "hint")}
              {...register("footerText")}
            />
          </FormField>
        </Section>

        <Section title="Branding" description="Images upload straight away; they appear on quotes once you save.">
          <div className="grid grid-cols-2 gap-4">
            <BrandingImageField
              slot="logo"
              label="Logo"
              hint="Top of every page. PNG with a transparent background works best."
              currentUrl={saved.logoUrl}
              change={images.logoUrl}
              onChange={(c) => setImage("logoUrl", c)}
              onUploadingChange={trackUpload}
              disabled={busy}
            />
            <BrandingImageField
              slot="watermark"
              label="Watermark"
              hint="Faint, behind page content. Uses the logo if empty."
              currentUrl={saved.watermarkLogoUrl}
              change={images.watermarkLogoUrl}
              onChange={(c) => setImage("watermarkLogoUrl", c)}
              onUploadingChange={trackUpload}
              disabled={busy}
            />
          </div>
          <BrandingImageField
            slot="cover"
            label="Cover image"
            hint="Full first page of the PDF. A landscape photo of your work, at least 1600 px wide."
            wide
            compress
            currentUrl={saved.coverImageUrl}
            change={images.coverImageUrl}
            onChange={(c) => setImage("coverImageUrl", c)}
            onUploadingChange={trackUpload}
            disabled={busy}
          />
        </Section>
      </div>

      <Section title="Quote defaults" description="Pre-filled on every new quote; each quote can change them.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            id={f("prefix")}
            label="Quote number prefix"
            error={errors.quoteNumberPrefix?.message}
            hint={`Numbers look like ${quoteNumberExample(prefix ?? "", year)}.`}
          >
            <Input
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-9 font-mono"
              maxLength={SETTINGS_LIMITS.prefix}
              disabled={busy}
              {...fieldAria(f("prefix"), errors.quoteNumberPrefix?.message, "hint")}
              {...register("quoteNumberPrefix")}
            />
          </FormField>
          <FormField
            id={f("validity")}
            label="Valid for"
            error={errors.quoteValidityDays?.message}
            hint="Sets each quote's “valid until” date."
          >
            <InputGroup className="h-9">
              <InputGroupInput
                inputMode="numeric"
                autoComplete="off"
                disabled={busy}
                {...fieldAria(f("validity"), errors.quoteValidityDays?.message, "hint")}
                {...register("quoteValidityDays")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>days</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </FormField>
          <FormField id={f("type")} label="Default project type" error={errors.defaultProjectType?.message}>
            <Input
              autoComplete="off"
              list={f("types")}
              className="h-9"
              disabled={busy}
              {...fieldAria(f("type"), errors.defaultProjectType?.message)}
              {...register("defaultProjectType")}
            />
            <datalist id={f("types")}>
              {PROJECT_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </FormField>
          <FormField
            id={f("gst")}
            label="Default GST"
            error={errors.defaultGstPercent?.message}
            hint="0 if you don't charge GST."
          >
            <InputGroup className="h-9">
              <InputGroupInput
                inputMode="decimal"
                autoComplete="off"
                disabled={busy}
                {...fieldAria(f("gst"), errors.defaultGstPercent?.message, "hint")}
                {...register("defaultGstPercent")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </FormField>
        </div>
        <Controller
          control={control}
          name="roundAmounts"
          render={({ field }) => (
            <label className="flex items-start justify-between gap-4 rounded-lg bg-muted/60 px-3 py-2.5 ring-1 ring-foreground/10 sm:max-w-xl">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">Round totals to whole rupees</span>
                <span className="block text-xs text-muted-foreground">Adds a round-off line to the PDF when needed.</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={busy} className="mt-1" />
            </label>
          )}
        />
      </Section>

      <Section title="Terms & exclusions" description="Default text for the last page of every new quote.">
        <FormField
          id={f("terms")}
          label="Terms and conditions"
          error={errors.defaultTerms?.message}
          hint={`${(terms ?? "").length.toLocaleString("en-IN")} / ${SETTINGS_LIMITS.defaultTerms.toLocaleString("en-IN")} characters. Line breaks are kept.`}
        >
          <Textarea
            rows={8}
            disabled={busy}
            placeholder={"e.g.\n1. 50% advance with the order, 40% before installation, 10% on handover.\n2. Prices are valid for 15 days."}
            {...fieldAria(f("terms"), errors.defaultTerms?.message, "hint")}
            {...register("defaultTerms")}
          />
        </FormField>
        <NotIncludedEditor control={control} register={register} getValues={getValues} errors={errors} disabled={busy} />
      </Section>

      <p className="text-xs text-muted-foreground">
        {saved.updatedAt ? `Last saved ${formatDateTime(saved.updatedAt)}.` : "Not saved yet — these are the defaults."} Rates live on
        the{" "}
        <Link href="/app/rate-card" className="font-medium text-ink underline underline-offset-4">
          rate card
        </Link>
        .
      </p>

      {/* Save bar: always reachable, highlighted while there are unsaved edits. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
            {uploading ? "Uploading image…" : dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          {dirty && (
            <Button type="button" variant="outline" size="lg" onClick={discard} disabled={busy}>
              Discard
            </Button>
          )}
          <Button type="submit" size="lg" disabled={busy || uploading || !dirty}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}
