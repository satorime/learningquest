"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { XPRewardProvider } from "@/contexts/xp-reward-context";
import { BadgeAwardListener } from "@/components/badges/badge-award-popup";
import { LevelUpListener } from "@/components/dashboard/level-up-popup";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <XPRewardProvider>
          {children}
          <BadgeAwardListener />
          <LevelUpListener />
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            containerClassName=""
            containerStyle={{}}
            toastOptions={{
              className: "",
              duration: 4000,
              style: {
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                boxShadow:
                  "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                fontSize: "14px",
                fontWeight: "500",
                maxWidth: "400px",
              },
              success: {
                style: {
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                },
                iconTheme: {
                  primary: "#22c55e",
                  secondary: "#ffffff",
                },
              },
              error: {
                style: {
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                },
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#ffffff",
                },
              },
              loading: {
                style: {
                  background: "#ffffff",
                  color: "#6b7280",
                  border: "1px solid #e2e8f0",
                },
              },
            }}
          />
        </XPRewardProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
