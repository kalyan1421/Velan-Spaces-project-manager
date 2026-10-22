"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldAria } from "@/components/app-shell/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { isApiError } from "@/lib/api/errors";
import { formatAmountInput } from "@/lib/api/money";
import { projectOps, projectOpsKeys } from "@/lib/api/project-ops";
import { membersOfType, memberNames, namesSummary, type ProjectMember } from "@/lib/api/project-members";
import type { Project, Role } from "@/lib/api/types";
import { MemberPicker } from "./member-picker";
import { budgetAccessOptions, pickerOptions, pruneBudgetAccess, type FormStaff } from "./project-form-people";
import {
  PROJECT_CODE_MAX,
  PROJECT_FIELD_ORDER,
  PROJECT_NAME_MAX,
  changedProjectFields,
  isDuplicateCodeError,
  memberPermissionsFor,
  parseMoney,
  pathAfterCreate,
  projectFormDefaults,
  projectFormSchema,
  returnPathAfterSave,
  sectionFromHash,
  toProjectPayload,
  type FormMode,
  type FormSection,
  type ProjectFormValues,
} from "./project-form-schema";
import { useUnsavedChangesWarning } from "./use-unsaved-changes";

type ProjectFormProps = {
  mode: FormMode;
  role: Role;
  /** The project being edited (edit mode). */
  project?: Project;
  /** Edit: whether the API returned money fields for this viewer. */
  canSeeBudget: boolean;
  /** Pickable staff (`GET /staff`, role-filtered by the API). */
  staff: FormStaff[];
  /** Edit: `GET /projects/:id/members`, for names the staff list lacks and the client accounts. */
  members?: ProjectMember[];
};

const NO_MEMBERS: ProjectMember[] = [];

/**
 * Single-page project create/edit form. Shows only what the viewer may set
 * (see `memberPermissionsFor`); edit sends only changed fields.
 * Sections carry anchors (`#details`, `#client`, `#budget`, `#members`).
 */
export function ProjectForm({ mode, role, project, canSeeBudget, staff, members = NO_MEMBERS }: ProjectFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const ids = useId();
  const fieldId = (name: string) => `${ids}-${name}`;
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const permissions = useMemo(() => memberPermissionsFor(role, { mode, canSeeBudget }), [role, mode, canSeeBudget]);
  const schema = useMemo(
    () => projectFormSchema({ money: permissions.money, originalCode: mode === "edit" ? project?.projectCode : undefined }),
    [permissions.money, mode, project?.projectCode],
  );
  const defaults = useMemo(() => projectFormDefaults(mode === "edit" ? project : undefined), [mode, project]);
  // What the project looked like as a request body, so edit can send only the difference.
  const initialPayload = useMemo(() => toProjectPayload(defaults, { mode, permissions }), [defaults, mode, permissions]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onTouched",
    shouldFocusError: false,
  });

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const managerIds = useWatch({ control, name: "managerIds" });
  const workerIds = useWatch({ control, name: "workerIds" });
  const budgetAccessIds = useWatch({ control, name: "budgetAccessManagerIds" });

  const names = useMemo(() => memberNames(members), [members]);
  const managerOptions = useMemo(() => pickerOptions(staff, "manager", managerIds, names), [staff, managerIds, names]);
  const workerOptions = useMemo(() => pickerOptions(staff, "worker", workerIds, names), [staff, workerIds, names]);
  const budgetOptions = useMemo(
    () => budgetAccessOptions(pickerOptions(staff, "manager", [...managerIds, ...budgetAccessIds], names), managerIds),
    [staff, managerIds, budgetAccessIds, names],
  );
  const projectManagers = membersOfType(members, "manager").map((m) => m.fullName);
  const clientAccounts = membersOfType(members, "client");

  const projectId = project?.id ?? "";
  const cancelHref = mode === "edit" ? `/app/projects/${projectId}` : "/app/projects";

  // `/edit#budget` (from the Budget tab) and `#members` land on that section.
  useEffect(() => {
    const section = sectionFromHash(window.location.hash);
    if (!section) return;
    const target = document.getElementById(section);
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    const focusable = target.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), fieldset[tabindex]");
    focusable?.focus({ preventScroll: true });
  }, []);

  const onInvalid = (formErrors: FieldErrors<ProjectFormValues>) => {
    const first = PROJECT_FIELD_ORDER.find((name) => formErrors[name]);
    if (first) setFocus(first);
  };

  const onSubmit = async (values: ProjectFormValues) => {
    setServerError(null);
    const body = toProjectPayload(values, { mode, permissions });
    try {
      if (mode === "create") {
        const created = await projectOps.createProject(body);
        // Clear the draft: Cache Components may keep this page alive for a later visit.
        reset(projectFormDefaults());
        queryClient.setQueryData(projectOpsKeys.project(created.id), created);
        toast.success(`${created.projectName} created`);
        router.push(pathAfterCreate(created.id, values.inviteClientNext));
        return;
      }

      const section = sectionFromHash(window.location.hash);
      const target = returnPathAfterSave(projectId, section, { money: permissions.money });
      const patch = changedProjectFields(body, initialPayload);
      if (Object.keys(patch).length === 0) {
        toast("No changes to save.");
        router.push(target);
        return;
      }
      const saved = await projectOps.updateProject(projectId, patch);
      reset(values);
      queryClient.setQueryData(projectOpsKeys.project(projectId), saved);
      // Tabs keep their own cached copies (budget summary under ["projects", id],
      // timeline/rooms under ["project", id]); a new server render's initialData
      // doesn't replace them, so mark them stale.
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      void queryClient.invalidateQueries({
        queryKey: ["project", projectId],
        predicate: (q) => q.queryKey.length > 2,
      });
      toast.success("Project saved");
      router.push(target);
      // Re-render the project header and tabs (shared layout) with the saved values.
      router.refresh();
    } catch (error) {
      if (isDuplicateCodeError(error)) {
        setError("projectCode", { type: "server", message: "Another project already uses this code. Choose a different one." });
        setFocus("projectCode");
        return;
      }
      if (isApiError(error) && error.status === 403) {
        setServerError(
          mode === "create"
            ? "Your account can't create projects. Ask your administrator."
            : "You can't make some of these changes. Only the administrator assigns managers, clients and budget access.",
        );
        return;
      }
      setServerError(isApiError(error) ? error.message : "Something went wrong. Please try again.");
    }
  };

  const busy = isSubmitting;
  const moneyField = (name: "budget" | "estimatedCost") => {
    const reg = register(name);
    return {
      ...reg,
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
        void reg.onBlur(e);
        const n = parseMoney(e.target.value);
        if (n !== null && e.target.value.trim() !== "") setValue(name, n === 0 ? "0" : formatAmountInput(n), { shouldDirty: true });
      },
    };
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="flex flex-col gap-5" aria-busy={busy}>
      {serverError && (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Section id="details" title="Project details">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FormField id={fieldId("name")} label="Project name" error={errors.projectName?.message}>
            <Input
              className="h-10"
              maxLength={PROJECT_NAME_MAX}
              autoComplete="off"
              placeholder="Lakeview Villa interiors"
              disabled={busy}
              {...fieldAria(fieldId("name"), errors.projectName?.message)}
              {...register("projectName")}
            />
          </FormField>
          <FormField
            id={fieldId("code")}
            label="Project code"
            error={errors.projectCode?.message}
            hint="Unique. Letters, numbers and - _ . / # (no spaces)."
          >
            <Input
              className="h-10 font-mono"
              maxLength={PROJECT_CODE_MAX}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="VS-2026-014"
              disabled={busy}
              {...fieldAria(fieldId("code"), errors.projectCode?.message, "hint")}
              {...register("projectCode")}
            />
          </FormField>
        </div>
        <FormField id={fieldId("location")} label="Location (optional)" error={errors.location?.message}>
          <Input
            className="h-10"
            autoComplete="off"
            placeholder="Area, city"
            disabled={busy}
            {...fieldAria(fieldId("location"), errors.location?.message)}
            {...register("location")}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={fieldId("start")} label="Start date (optional)" error={errors.startDate?.message}>
            <Input
              type="date"
              className="h-10"
              disabled={busy}
              {...fieldAria(fieldId("start"), errors.startDate?.message)}
              {...register("startDate")}
            />
          </FormField>
          <FormField id={fieldId("target")} label="Target completion (optional)" error={errors.targetEndDate?.message}>
            <Input
              type="date"
              className="h-10"
              disabled={busy}
              {...fieldAria(fieldId("target"), errors.targetEndDate?.message)}
              {...register("targetEndDate")}
            />
          </FormField>
        </div>
      </Section>

      <Section
        id="client"
        title="Client"
        description="Contact details for your team. Workers and the client portal don't see the phone or email."
      >
        <FormField id={fieldId("client-name")} label="Client name (optional)" error={errors.clientName?.message}>
          <Input
            className="h-10"
            autoComplete="off"
            disabled={busy}
            {...fieldAria(fieldId("client-name"), errors.clientName?.message)}
            {...register("clientName")}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={fieldId("client-phone")} label="Phone (optional)" error={errors.clientPhone?.message}>
            <Input
              type="tel"
              inputMode="tel"
              className="h-10"
              autoComplete="off"
              placeholder="+91 98400 12345"
              disabled={busy}
              {...fieldAria(fieldId("client-phone"), errors.clientPhone?.message)}
              {...register("clientPhone")}
            />
          </FormField>
          <FormField id={fieldId("client-email")} label="Email (optional)" error={errors.clientEmail?.message}>
            <Input
              type="email"
              inputMode="email"
              className="h-10"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              {...fieldAria(fieldId("client-email"), errors.clientEmail?.message)}
              {...register("clientEmail")}
            />
          </FormField>
        </div>
        {mode === "create" ? (
          <Controller
            control={control}
            name="inviteClientNext"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50">
                <Checkbox
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={busy}
                />
                <span className="text-sm">
                  <span className="block font-medium text-ink">Invite the client to the portal next</span>
                  <span className="block text-muted-foreground">
                    After creating the project, go straight to Client access to send them a sign-in invite.
                  </span>
                </span>
              </label>
            )}
          />
        ) : (
          <div className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            {clientAccounts.length > 0 ? (
              <>
                Portal access:{" "}
                <span className="font-medium text-ink">{namesSummary(clientAccounts.map((c) => c.fullName))}</span>.{" "}
              </>
            ) : (
              <>No client has portal access yet. </>
            )}
            <Link href={`/app/projects/${projectId}/client-access`} className="font-medium text-ink underline underline-offset-4">
              Manage client access
            </Link>
          </div>
        )}
      </Section>

      {permissions.money && (
        <Section
          id="budget"
          title="Budget"
          description={
            role === "manager" && mode === "create"
              ? "You'll have budget access on this project. Leave empty if it isn't agreed yet."
              : "Only the administrator and managers with budget access see these figures. Leave empty if not agreed yet."
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id={fieldId("budget")} label="Budget" error={errors.budget?.message} hint="The amount agreed with the client.">
              <InputGroup className="h-10">
                <InputGroupAddon>₹</InputGroupAddon>
                <InputGroupInput
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="15,00,000"
                  disabled={busy}
                  {...fieldAria(fieldId("budget"), errors.budget?.message, "hint")}
                  {...moneyField("budget")}
                />
              </InputGroup>
            </FormField>
            <FormField
              id={fieldId("estimate")}
              label="Estimated cost"
              error={errors.estimatedCost?.message}
              hint="Your internal estimate of what it will cost."
            >
              <InputGroup className="h-10">
                <InputGroupAddon>₹</InputGroupAddon>
                <InputGroupInput
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="12,00,000"
                  disabled={busy}
                  {...fieldAria(fieldId("estimate"), errors.estimatedCost?.message, "hint")}
                  {...moneyField("estimatedCost")}
                />
              </InputGroup>
            </FormField>
          </div>
        </Section>
      )}

      {(permissions.managers || permissions.workers) && (
        <Section
          id="members"
          title="Team"
          description="Members see this project in their app. Workers only see what's shared with them."
        >
          {permissions.managers ? (
            <Controller
              control={control}
              name="managerIds"
              render={({ field }) => (
                <MemberPicker
                  legend="Managers"
                  people={managerOptions}
                  value={field.value}
                  onChange={(next) => {
                    field.onChange(next);
                    setValue("budgetAccessManagerIds", pruneBudgetAccess(budgetAccessIds, next), { shouldDirty: true });
                  }}
                  error={errors.managerIds?.message}
                  emptyText="No manager accounts yet. Add managers on the Staff page."
                  fieldRef={field.ref}
                />
              )}
            />
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              {mode === "create"
                ? "You'll be the manager of this project. The administrator can add other managers."
                : projectManagers.length > 0
                  ? `Managers: ${namesSummary(projectManagers, 4)}. Only the administrator changes managers and budget access.`
                  : "Only the administrator changes managers and budget access."}
            </p>
          )}

          {permissions.budgetAccess && (
            <Controller
              control={control}
              name="budgetAccessManagerIds"
              render={({ field }) => (
                <MemberPicker
                  legend="Budget access"
                  description="These managers can see and record the budget, expenses and settlements."
                  people={budgetOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.budgetAccessManagerIds?.message}
                  emptyText="Select managers above first."
                  fieldRef={field.ref}
                />
              )}
            />
          )}

          {permissions.workers && (
            <Controller
              control={control}
              name="workerIds"
              render={({ field }) => (
                <MemberPicker
                  legend="Workers"
                  people={workerOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.workerIds?.message}
                  emptyText="No worker accounts yet. Add workers on the Staff page."
                  fieldRef={field.ref}
                />
              )}
            />
          )}
        </Section>
      )}

      <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-xl bg-card/95 px-4 py-3 shadow-sm ring-1 ring-foreground/10 backdrop-blur supports-backdrop-filter:bg-card/85 sm:flex-row sm:items-center sm:justify-end">
        {isDirty && !busy && <p className="text-xs text-muted-foreground sm:mr-auto">You have unsaved changes.</p>}
        {isDirty ? (
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => setConfirmLeave(true)}>
            Cancel
          </Button>
        ) : (
          <Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Cancel
          </Link>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? (
            <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
          ) : mode === "create" ? (
            <Plus data-icon="inline-start" aria-hidden />
          ) : (
            <Save data-icon="inline-start" aria-hidden />
          )}
          {busy ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create project" : "Save changes"}
        </Button>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "create" ? "The project hasn't been created yet." : "Your edits to this project haven't been saved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmLeave(false);
                reset(defaults);
                router.push(cancelHref);
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

/** One card of the form. Its id is the section name, so `/edit#budget` also works as a plain anchor. */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: FormSection;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-20 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6"
    >
      <div className="mb-4">
        <h2 id={`${id}-heading`} className="font-heading text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
