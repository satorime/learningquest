"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  PlusCircle,
  Award,
  UserCircle,
  Menu,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { LogoutButton } from "@/components/logout-button";
import { useAuth } from "@/lib/auth-context";

const teacherRoutes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard/teacher",
    color: "text-purple-500",
  },
  {
    label: "Students",
    icon: Users,
    href: "/teacher/students",
    color: "text-blue-500",
  },
  // {
  //   label: "Courses",
  //   icon: BookOpen,
  //   href: "/teacher/courses",
  //   color: "text-emerald-500"
  // },
  // {
  //   label: "Create Quest",
  //   icon: PlusCircle,
  //   href: "/teacher/quests/create",
  //   color: "text-orange-500"
  // },
  {
    label: "Badges",
    icon: Award,
    href: "/teacher/badges",
    color: "text-amber-500",
  },
  {
    label: "Profile",
    icon: UserCircle,
    href: "/teacher/profile",
    color: "text-sky-500",
  },
];

export function TeacherNavbar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const { user } = useAuth();

  // For smaller screens, automatically collapse the navbar to save space
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsExpanded(false);
      } else {
        setIsExpanded(true);
      }
    };

    // Set initial state based on screen size
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center px-2 pb-4 sm:pb-6 z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-auto max-w-full"
      >
        <div
          className={cn(
            "flex items-center gap-1 sm:gap-2 bg-background/95 backdrop-blur-lg rounded-full p-1.5 sm:p-2 shadow-xl border",
            "max-w-[calc(100vw-1rem)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "transition-all duration-300 ease-in-out",
            isExpanded ? "pr-4 sm:pr-6" : "hover:pr-6"
          )}
        >
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 p-2 hover:bg-accent rounded-full transition"
            aria-label={
              isExpanded ? "Collapse navigation" : "Expand navigation"
            }
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {teacherRoutes.map((route) => {
              const isActive = pathname === route.href;

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "relative shrink-0 px-2 sm:px-3 py-2 rounded-full transition-all duration-300",
                    "hover:bg-accent group flex items-center gap-2",
                    isActive && "bg-accent"
                  )}
                >
                  <route.icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? route.color : "text-muted-foreground",
                      "group-hover:text-foreground"
                    )}
                  />

                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className={cn(
                        "text-sm font-medium transition-colors",
                        isActive ? "text-foreground" : "text-muted-foreground",
                        "group-hover:text-foreground"
                      )}
                    >
                      {route.label}
                    </motion.span>
                  )}

                  {isActive && (
                    <motion.div
                      className="absolute inset-0 border rounded-full"
                      layoutId="navbar-active"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              );
            })}

            {user && (
              <>
                <div className="ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-muted shrink-0">
                  <LogoutButton
                    variant="ghost"
                    size="sm"
                    showIcon={isExpanded}
                    className={cn(
                      "rounded-full transition-all duration-300",
                      "hover:bg-accent group flex items-center",
                      !isExpanded && "px-2 py-2"
                    )}
                  />
                </div>
                <div className="ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-muted shrink-0">
                  <ModeToggle />
                </div>
              </>
            )}
          </nav>

          {isExpanded && (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </motion.div>
    </div>
  );
}
