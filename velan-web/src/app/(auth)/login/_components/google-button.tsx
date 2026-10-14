"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type CredentialResponse = { credential?: string };

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: { theme?: string; size?: string; text?: string; shape?: string; width?: number; logo_alignment?: string },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/**
 * Google Identity Services button. Only rendered when NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * is configured; hands the ID token to `onCredential` (→ POST /api/auth/google).
 */
export function GoogleButton({
  clientId,
  disabled,
  onCredential,
}: {
  clientId: string;
  disabled?: boolean;
  onCredential: (idToken: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [loaded, setLoaded] = useState(() => typeof window !== "undefined" && Boolean(window.google?.accounts?.id));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  const render = useCallback(() => {
    const gis = window.google?.accounts?.id;
    if (!gis || !container.current) return;
    gis.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) callback.current(response.credential);
      },
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    gis.renderButton(container.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "center",
      width: Math.min(352, container.current.offsetWidth || 320),
    });
  }, [clientId]);

  useEffect(() => {
    if (loaded) render();
  }, [loaded, render]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      <div
        ref={container}
        aria-busy={!loaded}
        className={disabled ? "pointer-events-none flex min-h-10 w-full justify-center opacity-60" : "flex min-h-10 w-full justify-center"}
      />
      {failed && <p className="text-center text-xs text-muted-foreground">Google sign-in couldn&apos;t load.</p>}
    </>
  );
}
