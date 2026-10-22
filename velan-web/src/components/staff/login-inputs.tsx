"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Attributes that stop browsers / password managers from autofilling the head's own credentials. */
export const NO_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": "",
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;

/**
 * Username input that lower-cases as you type (keeping the caret in place), with
 * mobile keyboards told not to capitalise or autocorrect. Forwards RHF `register`.
 */
export function UsernameInput({ className, onChange, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <Input
      {...props}
      {...NO_AUTOFILL}
      type="text"
      inputMode="text"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={cn("h-10 font-mono", className)}
      onChange={(e) => {
        const el = e.currentTarget;
        const lower = el.value.toLowerCase();
        if (lower !== el.value) {
          const { selectionStart, selectionEnd } = el;
          el.value = lower;
          el.setSelectionRange(selectionStart, selectionEnd);
        }
        onChange?.(e);
      }}
    />
  );
}

/** Email input for someone else's login (no autofill of the head's own address). */
export function LoginEmailInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <Input
      {...props}
      {...NO_AUTOFILL}
      type="email"
      inputMode="email"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={cn("h-10", className)}
    />
  );
}
