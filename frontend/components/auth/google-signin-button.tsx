"use client";

import { useEffect, useRef } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface Props {
  /** Called with the Google ID token (credential) on success. */
  onCredential: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

/**
 * Renders the official "Sign in with Google" button. Requires
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID; shows a disabled fallback button if unset.
 */
export function GoogleSignInButton({ onCredential, text = "continue_with" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => {
            if (response?.credential) onCredential(response.credential);
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          width: ref.current.offsetWidth || 320,
          text,
        });
      })
      .catch((err) => console.error("Google Sign-In load error:", err));

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, text]);

  // When no client ID is configured, show a visible disabled fallback so the
  // option is clearly present (instead of silently rendering nothing).
  if (!clientId) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled
          title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Sign-In"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium opacity-60"
        >
          <GoogleIcon />
          {text === "signup_with"
            ? "Sign up with Google"
            : text === "signin_with"
            ? "Sign in with Google"
            : "Continue with Google"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          Google Sign-In not configured
        </span>
      </div>
    );
  }

  return <div ref={ref} className="flex w-full justify-center" />;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
