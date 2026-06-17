"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Home,
  BookOpen,
  Info,
  LogIn,
  Menu,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { ModeToggle } from "@/components/ui/mode-toggle"

const routes = [
  {
    label: "Home",
    icon: Home,
    href: "/",
    color: "text-blue-500"
  },
  {
    label: "Learn More",
    icon: BookOpen,
    href: "/learn-more",
    color: "text-purple-500"
  }
]

export function LandingNavbar() {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(true)
  const { user } = useAuth()

  // For smaller screens, automatically collapse the navbar to save space
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsExpanded(false)
      } else {
        setIsExpanded(true)
      }
    }
    
    // Set initial state based on screen size
    handleResize()
    
    // Add event listener
    window.addEventListener('resize', handleResize)
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center px-2 pb-4 sm:pb-6 z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-auto max-w-full"
      >
        <div className={cn(
          "flex items-center gap-1 sm:gap-2 navbar-bottom rounded-full p-1.5 sm:p-2 shadow-xl border",
          "max-w-[calc(100vw-1rem)] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "transition-all duration-300 ease-in-out",
          isExpanded ? "pr-4 sm:pr-6" : "hover:pr-6"
        )}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="shrink-0 p-2 hover:bg-accent/20 rounded-full transition"
            aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
          >
            <Menu className="h-5 w-5 text-white" />
          </button>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {routes.map((route) => {
              const isActive = pathname === route.href
              
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "relative shrink-0 px-2 sm:px-3 py-2 rounded-full transition-all duration-300",
                    "hover:bg-white/10 group flex items-center gap-2",
                    isActive && "bg-white/10"
                  )}
                >
                  <route.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? route.color : "text-white/70",
                    "group-hover:text-white"
                  )} />
                  
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className={cn(
                        "text-sm font-medium transition-colors",
                        isActive ? "text-white" : "text-white/70",
                        "group-hover:text-white"
                      )}
                    >
                      {route.label}
                    </motion.span>
                  )}

                  {isActive && (
                    <motion.div
                      className="absolute inset-0 border border-white/20 rounded-full"
                      layoutId="landing-navbar-active"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30
                      }}
                    />
                  )}
                </Link>
              )
            })}

            <div className="ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-white/20 shrink-0">
              <Link href="/signin">
                <Button className="sign-in-button flex items-center gap-2 rounded-full px-3 sm:px-4">
                  <LogIn className="h-4 w-4" />
                  {isExpanded && <span>Sign In</span>}
                </Button>
              </Link>
            </div>

            <div className="ml-1 sm:ml-2 pl-1 sm:pl-2 border-l border-white/20 shrink-0">
              <ModeToggle />
            </div>
          </nav>

          {isExpanded && (
            <ChevronRight className="h-5 w-5 text-white/70" />
          )}
        </div>
      </motion.div>
    </div>
  )
} 