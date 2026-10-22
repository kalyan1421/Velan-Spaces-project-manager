"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ChangeEvent, type FocusEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SetBreadcrumbs } from "@/components/app-shell/breadcrumbs";
import { PageHeader } from "@/components/app-shell/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { MAX_PORTFOLIO_IMAGES, portfolioAdminApi } from "@/lib/api/portfolio-admin";
import type { PortfolioItem, PortfolioStatus } from "@/lib/api/types";
import { DetailsSection, PhotosSection, PublishingSection } from "./editor-sections";
import { ImageManager } from "./image-manager";
import {
  buildCreateBody,
  buildUpdateBody,
  makePortfolioFormSchema,
  toFormValues,
  type PortfolioFormValues,
} from "./portfolio-form";
import { canViewOnSite, previewSlug, publicPath, slugify } from "./portfolio-rules";
import { useUnsavedChangesGuard } from "./unsaved-changes";
import { useImageUploads } from "./use-image-uploads";
import { syncPublicSite, upsertItem, usePortfolioList, type ProjectOption } from "./use-portfolio";

const CREATED_MESSAGE: Record<PortfolioStatus, string> = {
  published: "is now on the website.",
  draft: "saved as a draft.",
  hidden: "saved (hidden from the website).",
};

type Props = {
  /** The saved item (edit) or undefined (create). */
  item?: PortfolioItem;
  /** Server-loaded list, used for slug previews and clash checks. */
  items?: PortfolioItem[];
  /** null = the projects list couldn't be loaded. */
  projects: ProjectOption[] | null;
};

/** Create / edit a portfolio item: details, photos, status and the linked project. */
export function PortfolioEditor({ item, items: initialItems, projects }: Props) {
  const mode = item ? "edit" : "create";
  const router = useRouter();
  const client = useQueryClient();
  const list = usePortfolioList(initialItems);

  // The last saved version: PATCH bodies are diffs against it.
  const [original, setOriginal] = useState(item);
  const [slugEdited, setSlugEdited] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const takenSlugs = useMemo(
    () => (list.data ?? []).filter((i) => i.id !== original?.id).map((i) => i.slug),
    [list.data, original?.id],
  );
  const schema = useMemo(() => makePortfolioFormSchema({ mode, takenSlugs }), [mode, takenSlugs]);

  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(item),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setValue, getValues, setError, reset, setFocus, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  const [coverImageUrl, imageUrls, slug] = useWatch({ control, name: ["coverImageUrl", "imageUrls", "slug"] });

  // ------------------------------------------------------------ photos
  const setImages = useCallback(
    (urls: string[]) => setValue("imageUrls", urls, { shouldDirty: true, shouldValidate: true }),
    [setValue],
  );
  const setCover = useCallback(
    (url: string | null) => setValue("coverImageUrl", url, { shouldDirty: true }),
    [setValue],
  );
  const isInGallery = useCallback((url: string) => getValues("imageUrls").includes(url), [getValues]);
  const isCover = useCallback((url: string) => getValues("coverImageUrl") === url, [getValues]);
  const appendToGallery = useCallback(
    (urls: string[]) => setImages(Array.from(new Set([...getValues("imageUrls"), ...urls]))),
    [getValues, setImages],
  );
  const replaceCover = useCallback((urls: string[]) => setCover(urls[urls.length - 1] ?? null), [setCover]);

  const gallery = useImageUploads({
    max: MAX_PORTFOLIO_IMAGES,
    existingCount: imageUrls.length,
    isTaken: isInGallery,
    onCommit: appendToGallery,
  });
  // The cover slot holds one photo: a new upload replaces it.
  const cover = useImageUploads({ max: 1, existingCount: 0, isTaken: isCover, onCommit: replaceCover });
  const uploading = gallery.busy || cover.busy;

  const { confirmLeave, allowLeave } = useUnsavedChangesGuard(isDirty || uploading);

  // ------------------------------------------------------------ slug
  const autoSlug = (title: string) => previewSlug(title, takenSlugs);

  const titleField = register("title", {
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (mode === "create" && !slugEdited) setValue("slug", autoSlug(e.target.value));
    },
  });
  const slugField = register("slug", {
    onChange: () => setSlugEdited(true),
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      const cleaned = slugify(e.target.value);
      if (cleaned === "" && mode === "create") {
        setSlugEdited(false);
        setValue("slug", autoSlug(getValues("title")), { shouldValidate: true });
      } else if (cleaned !== e.target.value) {
        setValue("slug", cleaned, { shouldValidate: true, shouldDirty: true });
      }
    },
  });

  const slugHint =
    mode === "edit" && original?.status === "published" && slug.trim() !== original.slug
      ? "Changing the address breaks links people have already shared."
      : mode === "create" && !slugEdited
        ? "Made from the title. You can change it."
        : "Lowercase letters, numbers and dashes.";

  // ------------------------------------------------------------ submit
  const onSubmit = handleSubmit(async (values) => {
    setServerErrors([]);
    if (uploading) {
      toast.error("Wait for the photos to finish uploading.");
      return;
    }
    try {
      if (!original) {
        const created = await portfolioAdminApi.create(buildCreateBody(values, { slugEdited }));
        upsertItem(client, created);
        void client.invalidateQueries({ queryKey: ["portfolio"] });
        syncPublicSite();
        toast.success(`“${created.title}” ${CREATED_MESSAGE[created.status]}`);
        // Activity keeps this page alive after we leave: start the next visit fresh.
        reset(toFormValues());
        setSlugEdited(false);
        allowLeave();
        router.push("/app/website");
        return;
      }

      const body = buildUpdateBody(original, values);
      if (Object.keys(body).length === 0) {
        reset(toFormValues(original));
        toast.info("No changes to save.");
        return;
      }
      const updated = await portfolioAdminApi.update(original.id, body);
      upsertItem(client, updated);
      syncPublicSite();
      setOriginal(updated);
      reset(toFormValues(updated));
      setSlugEdited(false);
      toast.success(`Saved “${updated.title}”.`, {
        action: canViewOnSite(updated)
          ? { label: "View on site", onClick: () => window.open(publicPath(updated.slug), "_blank", "noopener") }
          : undefined,
      });
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setError("slug", { message: "This web address is already used by another project." });
        setFocus("slug");
        return;
      }
      if (isApiError(error) && error.status === 404) {
        setServerErrors(["This project no longer exists. It may have been deleted in another tab."]);
        return;
      }
      setServerErrors(isApiError(error) ? error.messages : ["Something went wrong. Please try again."]);
    }
  });

  const leave = () => {
    if (confirmLeave()) router.push("/app/website");
  };

  const title = original ? original.title : "Add a project";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <SetBreadcrumbs items={[{ label: "Website", href: "/app/website" }, { label: original ? original.title : "New project" }]} />
      <PageHeader
        title={title}
        description={
          original
            ? "Changes go live on the website when you save (for published projects)."
            : "New projects start as drafts. Publish when the photos and text are ready."
        }
        actions={
          original && canViewOnSite(original) ? (
            <a
              href={publicPath(original.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <ExternalLink aria-hidden />
              View on site
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : undefined
        }
      />

      {serverErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t save</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-0.5">
              {serverErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <DetailsSection
            form={form}
            titleField={titleField}
            slugField={slugField}
            slugHint={slugHint}
            onSlugFromTitle={
              mode === "edit"
                ? () => {
                    setValue("slug", autoSlug(getValues("title")), { shouldDirty: true, shouldValidate: true });
                    setSlugEdited(true);
                  }
                : undefined
            }
          />
          <PhotosSection>
            <ImageManager
              coverImageUrl={coverImageUrl}
              imageUrls={imageUrls}
              onCoverChange={setCover}
              onImagesChange={setImages}
              gallery={gallery}
              cover={cover}
              error={errors.imageUrls?.message}
            />
          </PhotosSection>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <PublishingSection
            form={form}
            projects={projects}
            savedProjectId={original?.projectId ?? null}
            hasPhotos={Boolean(coverImageUrl) || imageUrls.length > 0}
          />
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl bg-card/95 px-4 py-3 shadow-sm ring-1 ring-foreground/10 backdrop-blur supports-backdrop-filter:bg-card/85">
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {uploading ? "Uploading photos…" : isDirty ? "Unsaved changes" : original ? "All changes saved" : ""}
        </p>
        <Button type="button" variant="outline" size="lg" onClick={leave}>
          {isDirty ? "Cancel" : "Back"}
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || uploading}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {isSubmitting ? "Saving…" : original ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
