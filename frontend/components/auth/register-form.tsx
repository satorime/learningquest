"use client";

import type React from "react";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";

export function RegisterForm() {
  const router = useRouter();
  const { register, verifyEmail, resendVerification, loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // verification step
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const data = {
      first_name: (formData.get("first_name") as string)?.trim(),
      last_name: (formData.get("last_name") as string)?.trim(),
      username: (formData.get("username") as string)?.trim(),
      email: (formData.get("email") as string)?.trim(),
      password: formData.get("password") as string,
    };

    try {
      const result = await register(data);
      if (result.success && result.email) {
        setPendingEmail(result.email);
        setInfo(result.message || "We emailed you a verification code.");
      } else {
        setError(result.error || "Registration failed. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingEmail) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await verifyEmail(pendingEmail, code.trim());
      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error || "Invalid code.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onResend() {
    if (!pendingEmail) return;
    setError("");
    const res = await resendVerification(pendingEmail);
    setInfo(res.message || "A new code was sent.");
  }

  const handleGoogle = useCallback(
    async (idToken: string) => {
      setIsLoading(true);
      setError("");
      try {
        const result = await loginWithGoogle(idToken);
        if (result.success) {
          router.push("/dashboard");
        } else {
          setError(result.error || "Google sign-up failed");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loginWithGoogle, router]
  );

  // --- verification step ---
  if (pendingEmail) {
    return (
      <div className="grid gap-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <strong>{pendingEmail}</strong>
          </p>
        </div>
        {info && <div className="text-center text-xs text-green-600">{info}</div>}
        <form onSubmit={onVerify} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="text-center text-lg tracking-widest"
              disabled={isLoading}
              required
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button type="submit" disabled={isLoading || code.length < 4} className="w-full">
            {isLoading ? "Verifying..." : "Verify & continue"}
          </Button>
        </form>
        <button
          type="button"
          onClick={onResend}
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Resend code
        </button>
      </div>
    );
  }

  // --- registration step ---
  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" name="first_name" type="text"
                autoComplete="given-name" disabled={isLoading} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" name="last_name" type="text"
                autoComplete="family-name" disabled={isLoading} required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" type="text"
              autoCapitalize="none" autoComplete="username" minLength={3}
              disabled={isLoading} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" placeholder="name@example.com"
              type="email" autoCapitalize="none" autoComplete="email"
              autoCorrect="off" disabled={isLoading} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password"
              autoComplete="new-password" minLength={8}
              disabled={isLoading} required />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button disabled={isLoading} type="submit" className="w-full">
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </div>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <GoogleSignInButton onCredential={handleGoogle} text="signup_with" />
    </div>
  );
}
