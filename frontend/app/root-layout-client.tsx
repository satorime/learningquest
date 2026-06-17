'use client'

import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "./providers"
import { AppLayout } from "@/components/layout/app-layout"
import { IdleCursor } from "@/components/ui/idle-cursor"
import { ConfirmProvider } from "@/components/ui/confirm-dialog"
import { NotifyProvider } from "@/components/ui/notify-dialog"
import type { ReactNode } from "react"

interface RootLayoutClientProps {
  children: ReactNode
}

export function RootLayoutClient({ children }: RootLayoutClientProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <Providers>
        <ConfirmProvider>
          <NotifyProvider>
            <AppLayout>
              {children}
            </AppLayout>
            <IdleCursor idleTimeout={8000} />
          </NotifyProvider>
        </ConfirmProvider>
      </Providers>
    </ThemeProvider>
  )
} 