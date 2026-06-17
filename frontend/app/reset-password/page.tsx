"use client";

import type React from "react";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const token = (form.get("token") as string) || tokenFromUrl;
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }
    try {
      await apiClient.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/signin"), 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid or expired reset token."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        </div>
        {done ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            Password updated. Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            {!tokenFromUrl && (
              <div className="grid gap-2">
                <Label htmlFor="token">Reset token</Label>
                <Input id="token" name="token" type="text" disabled={isLoading} required />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" minLength={8}
                autoComplete="new-password" disabled={isLoading} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" name="confirm" type="password" minLength={8}
                autoComplete="new-password" disabled={isLoading} required />
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/signin" className="underline underline-offset-4 hover:text-primary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
