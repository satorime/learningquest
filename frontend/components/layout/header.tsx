"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/logout-button"
import { useAuth } from "@/lib/auth-context"

export function Header() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  
  // Handle client-side effects
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">LearningQuest</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-2">
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href={user.role === "teacher" ? "/teacher/dashboard" : "/dashboard"}
                    className="text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    href="/profile"
                    className="text-sm font-medium"
                  >
                    Profile
                  </Link>
                </Button>
                <LogoutButton variant="ghost" size="sm" />
              </>
            ) : (
              pathname !== "/signin" && (
                <Button asChild size="sm">
                  <Link href="/signin">Sign In</Link>
                </Button>
              )
            )}
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
} 