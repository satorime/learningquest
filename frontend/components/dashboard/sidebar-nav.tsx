"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Award,
  BookOpen,
  Settings,
  Trophy,
  UserCircle,
  Film,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define nav items with icons
const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: "Courses",
    href: "/courses",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    title: "Quests",
    href: "/quests",
    icon: <Trophy className="h-5 w-5" />,
  },
  {
    title: "Capture the Flag",
    href: "/capture-the-flag/sessions",
    icon: <Flag className="h-5 w-5" />,
  },
  {
    title: "Leaderboard",
    href: "/leaderboard",
    icon: <Award className="h-5 w-5" />,
  },
  {
    title: "Community",
    href: "/community",
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: "Tutorials",
    href: "/tutorials",
    icon: <Film className="h-5 w-5" />,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: <Settings className="h-5 w-5" />,
  },
  {
    title: "Profile",
    href: "/profile/me",
    icon: <UserCircle className="h-5 w-5" />,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col border-r">
      <div className="border-b p-4 flex justify-between items-center">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold"
        >
          <Trophy className="h-6 w-6" />
          <span className="text-xl">LearningQuest</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="grid gap-2 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-slate-900 transition-all hover:text-slate-900",
                "dark:text-slate-50 dark:hover:text-slate-50",
                pathname === item.href
                  ? "bg-slate-200 dark:bg-slate-800 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800/80 dark:text-slate-400"
              )}
            >
              {item.icon}
              {item.title}
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t p-4">
        <ModeToggle />
      </div>
    </div>
  );
}
