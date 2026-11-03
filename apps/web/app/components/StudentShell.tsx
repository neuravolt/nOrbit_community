"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStudentAuthStore } from "@/src/store/student-auth";
import { Gift, BookOpen, Flame, User, LogOut, CheckSquare, Sparkles, LayoutDashboard, Target, FolderOpen, MessageSquare, Award, Dna, GitBranch, TrendingUp, MessageCircle, CalendarClock, Workflow, Scale, ClipboardCheck, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { StudentAuthGuard } from "./StudentAuthGuard";
import { LaunchpadLogo } from "./LaunchpadLogo";

// Single source of truth for the student nav — both /launchpad/* and /student/*
// route groups render this same shell (via LaunchpadLayout and StudentLayout),
// so this list only needs to be kept correct in one place.
const studentNavItems = [
  { href: "/launchpad/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-violet-400" },
  { href: "/launchpad/github", label: "GitHub", icon: GitBranch, color: "text-slate-300" },
  { href: "/launchpad/trust-score", label: "Skill Graph", icon: TrendingUp, color: "text-fuchsia-400" },
  { href: "/launchpad/tasks", label: "Tasks", icon: CheckSquare, color: "text-emerald-400" },
  { href: "/launchpad/messages", label: "Chat Workspace", icon: MessageCircle, color: "text-indigo-400" },
  { href: "/launchpad/calendar", label: "Scheduler", icon: CalendarClock, color: "text-amber-400" },
  { href: "/launchpad/pipeline", label: "Pipeline", icon: Workflow, color: "text-orange-400" },
  { href: "/launchpad/disputes", label: "Disputes", icon: Scale, color: "text-rose-400" },
  { href: "/launchpad/rewards", label: "Rewards", icon: Gift, color: "text-pink-400" },
  { href: "/student/careers", label: "My Career", icon: Target, color: "text-purple-400" },
  { href: "/student/technologies", label: "Technologies", icon: BookOpen, color: "text-blue-400" },
  { href: "/student/portfolio", label: "Portfolio", icon: FolderOpen, color: "text-teal-400" },
  { href: "/student/skill-passport", label: "Skill Passport", icon: Award, color: "text-yellow-400" },
  { href: "/student/career-dna", label: "Career DNA", icon: Dna, color: "text-green-400" },
  { href: "/student/mentor-reviews", label: "Reviews", icon: MessageSquare, color: "text-amber-400" },
  { href: "/student/peer-reviews", label: "Peer Reviews", icon: ClipboardCheck, color: "text-cyan-400" },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { student, isAuthenticated, logout } = useStudentAuthStore();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile nav drawer on every route change so it doesn't stay open behind the next page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch updated student metadata (points, streak) in real-time
  const { data: dashboardData } = useQuery({
    queryKey: ["student-dashboard-meta", student?.id],
    queryFn: async () => {
      const { data } = await api.get("/launchpad/dashboard");
      return data;
    },
    enabled: isAuthenticated && !!student?.id && mounted,
  });

  if (!mounted) return null;

  const handleLogout = () => {
    logout();
    router.push("/launchpad/login");
  };

  const currentPoints = dashboardData?.student?.totalPoints ?? student?.level ?? 0;
  const currentLevel = dashboardData?.student?.level ?? student?.level ?? 1;
  const currentStreak = dashboardData?.student?.currentStreak ?? 0;

  const isActiveHref = (href: string) => (href === "/launchpad/dashboard" ? pathname === href : pathname.startsWith(href));
  const navLink = (href: string, label: string, Icon: React.ElementType, onClick?: () => void) => {
    const active = isActiveHref(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onClick}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : "text-slate-400"}`} />
        {label}
      </Link>
    );
  };

  const stats = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-3 gap-2 text-center">
      <div><p className="text-sm font-bold text-slate-900 tabular-nums">{currentPoints}</p><p className="text-[10px] text-slate-500">Points</p></div>
      <div><p className="text-sm font-bold text-slate-900 tabular-nums">{currentLevel}</p><p className="text-[10px] text-slate-500">Level</p></div>
      <div><p className="text-sm font-bold text-slate-900 tabular-nums flex items-center justify-center gap-0.5">{currentStreak > 0 && <Flame className="w-3.5 h-3.5 text-orange-500" />}{currentStreak}d</p><p className="text-[10px] text-slate-500">Streak</p></div>
    </div>
  );

  return (
    <StudentAuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
        {/* Top bar: always on phones, and on every size before sign-in */}
        <header className={`sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200 ${isAuthenticated ? "md:hidden" : ""}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/launchpad" className="flex items-center"><LaunchpadLogo size="md" /></Link>
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {currentPoints} pts · Lvl {currentLevel}
                </span>
                <Link href="/launchpad/profile" className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900" aria-label="Profile">
                  <User className="w-4 h-4" />
                </Link>
                <button onClick={() => setDrawerOpen(true)} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900" aria-label="Open menu">
                  <Menu className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/launchpad/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
                <Link href="/launchpad/apply" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold">Apply now</Link>
              </div>
            )}
          </div>
        </header>

        {/* Phone quick links */}
        {isAuthenticated && (
          <div className="md:hidden sticky top-14 z-30 bg-white border-b border-slate-200 grid grid-cols-5 py-2 text-[10px] font-medium">
            {[
              { href: "/launchpad/dashboard", label: "Home", icon: LayoutDashboard },
              { href: "/launchpad/tasks", label: "Tasks", icon: CheckSquare },
              { href: "/launchpad/leads", label: "Leads", icon: Sparkles },
              { href: "/launchpad/rewards", label: "Rewards", icon: Gift },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 ${isActiveHref(href) ? "text-indigo-600" : "text-slate-500"}`}>
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
            <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-0.5 text-slate-500">
              <Menu className="w-4 h-4" />
              <span>More</span>
            </button>
          </div>
        )}

        {/* Phone menu drawer: the full list, same as the desktop sidebar */}
        {isAuthenticated && drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-slate-900/30" onClick={() => setDrawerOpen(false)} />
            <aside className="relative ml-auto w-72 max-w-[85vw] h-full bg-white border-l border-slate-200 flex flex-col overflow-y-auto p-4 gap-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm">Menu</span>
                <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500" aria-label="Close menu">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {stats}
              <nav className="space-y-0.5">
                {studentNavItems.map(({ href, label, icon }) => navLink(href, label, icon, () => setDrawerOpen(false)))}
              </nav>
              <button onClick={handleLogout} className="mt-auto flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-row">
          {/* Desktop sidebar */}
          {isAuthenticated && (
            <aside className="hidden md:flex w-60 bg-white border-r border-slate-200 flex-col justify-between h-screen sticky top-0 z-40 p-4 shrink-0 overflow-y-auto">
              <div className="space-y-5">
                <Link href="/launchpad" className="flex items-center px-1"><LaunchpadLogo size="md" /></Link>
                {stats}
                <nav className="space-y-0.5">
                  {studentNavItems.map(({ href, label, icon }) => navLink(href, label, icon))}
                </nav>
              </div>
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-3 px-1">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                    {student?.fullName?.charAt(0) || "S"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{student?.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{student?.email}</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </aside>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-5 text-xs text-slate-500">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="font-medium text-slate-600">NeuraVolt LaunchPad</span>
                <p>© {new Date().getFullYear()} NeuraVolt. All rights reserved.</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </StudentAuthGuard>
  );
}
