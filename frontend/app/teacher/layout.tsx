'use client'

import { RoleGuard } from "@/components/auth/role-guard"
import { UserRole } from "@/lib/roles"
import { TeacherNavbar } from "@/components/ui/teacher-navbar"

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]} fallbackPath="/dashboard">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </div>
    </RoleGuard>
  )
} 