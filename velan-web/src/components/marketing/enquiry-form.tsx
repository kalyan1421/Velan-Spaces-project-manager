"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { cn } from "cn";

import { budgetRanges, otherProjectType, services, site, telHref, whatsappHref } from "../../content/site";
import {
  GENERIC_FAILURE_MESSAGE,
  enquirySchema,
  type EnquiryData,
  type EnquiryField,
  type EnquiryFormValues,
  type EnquiryResponse,
} from "./enquiry-schema";
import { buttonStyles, textLinkStyles } from "./primitives";

type Status =
  | { kind: "idle" }
  | { kind: "success"; firstName: string }
  | { kind: "error"; message: string };

const FIELD_ORDER: EnquiryField[] = [
  "name",
  "phone",
  "projectType",
  "location",
  "budgetRange",
  "email",
  "message",
  "consent",
];

const inputClass =
  "block w-full min-h-12 rounded-xl border border-ink/50 bg-white px-4 text-base text-ink placeholder:text-ink/65 transition-colors hover:border-ink/75 focus:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-red-700";

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-[0.95rem] font-medium text-ink">
        {label}
        {optional ? <span className="text-sm font-normal text-ink/65">(optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink/70">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, opts: { hint?: boolean; error?: boolean }): string | undefined {
  const ids = [opts.hint ? `${id}-hint` : null, opts.error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function mailtoHref(values: EnquiryFormValues): string {
  const lines = [
    values.name ? `Name: ${values.name}` : null,
    values.phone ? `Phone: ${values.phone}` : null,
    values.location ? `Location: ${values.location}` : null,
    values.projectType ? `Project type: ${values.projectType}` : null,
    values.budgetRange ? `Budget: ${values.budgetRange}` : null,
    values.message ? `\n${values.message}` : null,
  ].filter(Boolean);
  const subject = encodeURIComponent("Enquiry from the website");
  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${site.email}?subject=${subject}&body=${body}`;
}

export function EnquiryForm() {
  const baseId = useId();
  const id = (name: string) => `${baseId}-${name}`;
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const successRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryFormValues, unknown, EnquiryData>({
    resolver: zodResolver(enquirySchema),
    mode: "onTouched",
    shouldFocusError: true,
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      location: "",
      projectType: "",
      budgetRange: "",
      message: "",
      company: "",
      consent: false,
    },
  });

  // Pre-select the project type when arriving from a service ("?service=modular-kitchens").
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("service");
    const service = services.find((item) => item.slug === slug);
    if (service && !getValues("projectType")) setValue("projectType", service.title);
  }, [getValues, setValue]);

  useEffect(() => {
    if (status.kind === "success") successRef.current?.focus();
    if (status.kind === "error") errorRef.current?.focus();
  }, [status]);

  async function onSubmit(data: EnquiryData) {
    setStatus({ kind: "idle" });
    let response: Response;
    try {
      response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      setStatus({ kind: "error", message: GENERIC_FAILURE_MESSAGE });
      return;
    }

    let body: EnquiryResponse | null = null;
    try {
      body = (await response.json()) as EnquiryResponse;
    } catch {
      body = null;
    }

    if (response.ok && body?.ok) {
      setStatus({ kind: "success", firstName: data.name.split(/\s+/)[0] ?? "" });
      reset();
      return;
    }

    if (body && !body.ok && body.fieldErrors && Object.keys(body.fieldErrors).length > 0) {
      const fieldErrors = body.fieldErrors;
      for (const field of FIELD_ORDER) {
        const message = fieldErrors[field];
        if (message) setError(field, { type: "server", message });
      }
      const first = FIELD_ORDER.find((field) => fieldErrors[field]);
      if (first) setFocus(first);
      return;
    }

    setStatus({
      kind: "error",
      message: body && !body.ok && body.formError ? body.formError : GENERIC_FAILURE_MESSAGE,
    });
  }

  const tel = telHref();
  const whatsapp = whatsappHref();

  if (status.kind === "success") {
    return (
      <div role="status" className="rounded-3xl border border-ink/10 bg-canvas p-6 sm:p-10">
        <span aria-hidden="true" className="block size-12 rounded-full bg-sun" />
        <h2
          ref={successRef}
          tabIndex={-1}
          className="mt-6 font-heading text-3xl font-light tracking-[-0.02em] text-ink focus:outline-none"
        >
          Thanks{status.firstName ? `, ${status.firstName}` : ""}. We&apos;ve got your enquiry.
        </h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/75">{site.callbackPromise}</p>
        <p className="mt-2 max-w-md leading-relaxed text-ink/75">
          If anything changes before then, email us at{" "}
          <a href={`mailto:${site.email}`} className={textLinkStyles}>
            {site.email}
          </a>
          .
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/portfolio" className={buttonStyles.primary}>
            Browse our work
          </Link>
          <button type="button" onClick={() => setStatus({ kind: "idle" })} className={textLinkStyles}>
            Send another enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      aria-describedby={`${baseId}-required-note`}
      className="relative"
    >
      <p id={`${baseId}-required-note`} className="text-sm text-ink/70">
        Name and mobile number are required. Everything else helps us prepare for the call.
      </p>

      {status.kind === "error" ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 rounded-2xl border border-red-700/30 bg-red-50 p-5 focus:outline-none"
        >
          <p className="font-medium text-red-800">{status.message}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/80">
            Your details are still in the form. Try again, or reach us directly:
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <a href={mailtoHref(getValues())} className={textLinkStyles}>
                Email {site.email}
              </a>
            </li>
            {tel && site.phone ? (
              <li>
                <a href={tel} className={textLinkStyles}>
                  Call {site.phone}
                </a>
              </li>
            ) : null}
            {whatsapp ? (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={textLinkStyles}>
                  WhatsApp us
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Field id={id("name")} label="Your name" error={errors.name?.message} className="sm:col-span-2">
          <input
            id={id("name")}
            type="text"
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            aria-required="true"
            aria-describedby={describedBy(id("name"), { error: Boolean(errors.name) })}
            className={inputClass}
            {...register("name")}
          />
        </Field>

        <Field
          id={id("phone")}
          label="Mobile number"
          hint="We'll call you on this number."
          error={errors.phone?.message}
          className="sm:col-span-2"
        >
          <input
            id={id("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            aria-invalid={errors.phone ? true : undefined}
            aria-required="true"
            aria-describedby={describedBy(id("phone"), { hint: true, error: Boolean(errors.phone) })}
            className={inputClass}
            {...register("phone")}
          />
        </Field>

        <Field id={id("projectType")} label="Project type" optional error={errors.projectType?.message}>
          <div className="relative">
            <select
              id={id("projectType")}
              aria-invalid={errors.projectType ? true : undefined}
              aria-describedby={describedBy(id("projectType"), { error: Boolean(errors.projectType) })}
              className={cn(inputClass, "appearance-none pr-11")}
              {...register("projectType")}
            >
              <option value="">Choose one</option>
              {services.map((service) => (
                <option key={service.slug} value={service.title}>
                  {service.title}
                </option>
              ))}
              <option value={otherProjectType}>{otherProjectType}</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink/70" />
          </div>
        </Field>

        <Field id={id("budgetRange")} label="Budget range" optional error={errors.budgetRange?.message}>
          <div className="relative">
            <select
              id={id("budgetRange")}
              aria-invalid={errors.budgetRange ? true : undefined}
              aria-describedby={describedBy(id("budgetRange"), { error: Boolean(errors.budgetRange) })}
              className={cn(inputClass, "appearance-none pr-11")}
              {...register("budgetRange")}
            >
              <option value="">Not sure yet</option>
              {budgetRanges.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink/70" />
          </div>
        </Field>

        <Field id={id("location")} label="Area and city" optional error={errors.location?.message}>
          <input
            id={id("location")}
            type="text"
            autoComplete="address-level2"
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={describedBy(id("location"), { error: Boolean(errors.location) })}
            className={inputClass}
            {...register("location")}
          />
        </Field>

        <Field id={id("email")} label="Email" optional error={errors.email?.message}>
          <input
            id={id("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy(id("email"), { error: Boolean(errors.email) })}
            className={inputClass}
            {...register("email")}
          />
        </Field>

        <Field
          id={id("message")}
          label="Tell us about your project"
          optional
          error={errors.message?.message}
          className="sm:col-span-2"
        >
          <textarea
            id={id("message")}
            rows={4}
            placeholder="Rooms, timeline, anything you already have in mind"
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={describedBy(id("message"), { error: Boolean(errors.message) })}
            className={cn(inputClass, "min-h-32 py-3 leading-relaxed")}
            {...register("message")}
          />
        </Field>
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={id("company")}>Company (leave this empty)</label>
        <input id={id("company")} type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
      </div>

      <div className="mt-8">
        <div className="flex items-start gap-3">
          <input
            id={id("consent")}
            type="checkbox"
            aria-invalid={errors.consent ? true : undefined}
            aria-required="true"
            aria-describedby={describedBy(id("consent"), { error: Boolean(errors.consent) })}
            className="mt-0.5 size-5 shrink-0 rounded border-ink/40 accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            {...register("consent")}
          />
          <label htmlFor={id("consent")} className="text-[0.95rem] leading-relaxed text-ink/85">
            I agree that {site.name} may contact me about this enquiry and store my details as described in the{" "}
            <Link href="/privacy" className={textLinkStyles} target="_blank">
              privacy notice<span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </label>
        </div>
        {errors.consent?.message ? (
          <p id={`${id("consent")}-error`} className="mt-2 text-sm text-red-700">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting || undefined}
        className={cn(buttonStyles.primary, "mt-8 w-full sm:w-auto")}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
            Sending…
          </>
        ) : (
          "Request a call back"
        )}
      </button>
    </form>
  );
}
