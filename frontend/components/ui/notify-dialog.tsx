"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export interface NotifyOptions {
  title?: string;
  description?: React.ReactNode;
  variant?: "success" | "error" | "info";
  okText?: string;
}

type NotifyFn = (opts: NotifyOptions) => Promise<void>;

const NotifyContext = React.createContext<NotifyFn | null>(null);

/**
 * A simple center-screen result popup (success / error / info) with a single
 * OK button. Mount once near the app root, then `const notify = useNotify()` and
 * `await notify({ variant: "success", description: "Saved." })`.
 */
export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<NotifyOptions>({});
  const resolverRef = React.useRef<(() => void) | null>(null);

  const notify = React.useCallback<NotifyFn>((options) => {
    setOpts(options ?? {});
    setOpen(true);
    return new Promise<void>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = React.useCallback(() => {
    setOpen(false);
    resolverRef.current?.();
    resolverRef.current = null;
  }, []);

  const variant = opts.variant ?? "info";
  const Icon =
    variant === "success" ? CheckCircle2 : variant === "error" ? XCircle : Info;
  const iconColor =
    variant === "success"
      ? "text-green-600"
      : variant === "error"
      ? "text-red-600"
      : "text-primary";
  const defaultTitle =
    variant === "success"
      ? "Success"
      : variant === "error"
      ? "Something went wrong"
      : "Notice";

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) settle(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />
              {opts.title ?? defaultTitle}
            </AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={settle}>
              {opts.okText ?? "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </NotifyContext.Provider>
  );
}

export function useNotify(): NotifyFn {
  const ctx = React.useContext(NotifyContext);
  if (!ctx) {
    throw new Error("useNotify must be used within a NotifyProvider");
  }
  return ctx;
}
