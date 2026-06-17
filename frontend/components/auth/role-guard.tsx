import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { UserRole } from "@/lib/roles"

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallbackPath?: string
}

export function RoleGuard({ children, allowedRoles, fallbackPath = "/dashboard" }: RoleGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      // If no user, don't redirect - the auth context will handle that
      if (user) {
        const hasAccess = allowedRoles.includes(user.role as UserRole)
        if (!hasAccess) {
          router.replace(fallbackPath)
        }
      }
      setHasChecked(true)
    }
  }, [user, isLoading, allowedRoles, fallbackPath, router])

  // During first render or while checking role, show a loading indicator
  if (isLoading || !hasChecked) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If user exists and has appropriate role
  if (user && allowedRoles.includes(user.role as UserRole)) {
    return <>{children}</>
  }

  // Otherwise render nothing (we're redirecting)
  return null
} 