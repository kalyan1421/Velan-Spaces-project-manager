"use client";

import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mailtoUrl, whatsappShareUrl } from "@/lib/api/accounts";
import { formatDateTime } from "@/lib/format";

/** Clipboard copy with a short "Copied" state. Falls back to selecting `fallbackRef`. */
export function useCopy(fallbackRef?: React.RefObject<HTMLInputElement | null>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async (value: string, what = "Link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${what} copied`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked (insecure origin, permissions): let the person copy by hand.
      fallbackRef?.current?.focus();
      fallbackRef?.current?.select();
      toast.message("Press Ctrl+C (or ⌘C) to copy.");
    }
  };

  return { copied, copy };
}

export function CopyButton({
  value,
  what = "Link",
  label = "Copy",
  variant = "outline",
  className,
  fallbackRef,
}: {
  value: string;
  what?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  fallbackRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const { copied, copy } = useCopy(fallbackRef);
  return (
    <Button type="button" variant={variant} size="lg" className={className} onClick={() => copy(value, what)}>
      {copied ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
      {copied ? "Copied" : label}
      <span className="sr-only" aria-live="polite">
        {copied ? `${what} copied to clipboard` : ""}
      </span>
    </Button>
  );
}

/**
 * A one-time link with Copy / WhatsApp / Email actions and its expiry.
 * The link only leaves the page on an explicit click (to WhatsApp or the mail app);
 * it is never put in our own URLs, logs or analytics.
 */
export function ShareLinkPanel({
  label,
  url,
  expiresAt,
  message,
  emailTo,
  emailSubject,
  note,
}: {
  label: string;
  url: string;
  expiresAt: string | null;
  /** Friendly text sent with WhatsApp / email (includes the link). */
  message: string;
  /** Show an Email action addressed to this person (omit for workers: no mailbox). */
  emailTo?: string | null;
  emailSubject: string;
  note?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const linkClass = buttonVariants({ variant: "outline", size: "lg" });

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-url`} className="text-sm font-medium text-ink">
          {label}
        </label>
        <Input
          id={`${id}-url`}
          ref={inputRef}
          value={url}
          readOnly
          spellCheck={false}
          autoComplete="off"
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 bg-card font-mono text-xs"
          aria-describedby={expiresAt ? `${id}-expiry` : undefined}
        />
        {expiresAt && (
          <p id={`${id}-expiry`} className="text-xs text-muted-foreground">
            Works once · expires {formatDateTime(expiresAt)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={url} what="Link" label="Copy link" variant="default" fallbackRef={inputRef} />
        <a
          href={whatsappShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <MessageCircle data-icon="inline-start" aria-hidden />
          WhatsApp
          <span className="sr-only">(opens WhatsApp)</span>
        </a>
        {emailTo && (
          <a href={mailtoUrl({ to: emailTo, subject: emailSubject, body: message })} className={linkClass}>
            <Mail data-icon="inline-start" aria-hidden />
            Email
            <span className="sr-only">(opens your mail app)</span>
          </a>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
