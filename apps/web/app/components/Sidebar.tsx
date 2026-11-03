"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, FolderKanban, TicketIcon, Settings, LogOut,
  Building2, TrendingUp, Package, FileText, Receipt, BarChart3, ShieldCheck, Clock,
  Layers, Cog, CheckSquare, Rocket, Briefcase, Bot, Activity, BookOpen, Server, Video,
  ChevronLeft, ChevronRight, Award, LayoutTemplate, Gift, Gauge, Sparkles, CreditCard, Mail, FolderArchive,
  Menu, X, MessagesSquare
} from "lucide-react";
import { useAuthStore } from "@/src/store/auth";
import { useCompanyProfile } from "@/src/hooks/queries";
import { useEffect, useState } from "react";

// Guardian command-center pages (own nav item; the "Guardian SRE" item keeps every other /guardian/* page).
const GUARDIAN_COMMAND_PATHS: string[] = [];

// ─── All possible nav items with role restrictions ───────────────────────────
const allNavItems = [
  { href: "/",                icon: LayoutDashboard, label: "Dashboard",      roles: null, permission: null, category: "Overview" },
  { href: "/chat",            icon: MessagesSquare,  label: "NeuraChat",      roles: null, permission: null, category: "Communication & Work" },
  { href: "/leads",           icon: TrendingUp,       label: "Pipeline",      roles: ["SUPER_ADMIN", "MANAGER", "SALES"], permission: "lead:read", category: "Finance & Sales" },
  { href: "/sales",           icon: FileText,         label: "Quotations",    roles: ["SUPER_ADMIN", "MANAGER", "SALES"], permission: "quote:read", category: "Finance & Sales" },
  { href: "/billing",         icon: Receipt,          label: "Billing",       roles: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"], permission: "invoice:read", category: "Finance & Sales" },
  { href: "/accounting",      icon: BookOpen,         label: "Ledger",        roles: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"], permission: "accounting:read", category: "Finance & Sales" },
  { href: "/hr",              icon: Briefcase,        label: "Workspace",     roles: null, permission: null, category: "Operations & HR" },
  { href: "/clients",         icon: Building2,        label: "Clients",       roles: ["SUPER_ADMIN", "MANAGER", "SALES"], permission: "client:read", category: "Operations & HR" },
  { href: "/projects",        icon: FolderKanban,     label: "Projects",      roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA"], permission: "project:read", category: "Operations & HR" },
  { href: "/tasks",           icon: CheckSquare,      label: "Tasks",         roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA"], permission: "task:read", category: "Operations & HR" },
  { href: "/tickets",         icon: TicketIcon,       label: "Tickets",       roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA", "SUPPORT"], permission: "ticket:read", category: "Operations & HR" },
  { href: "/assets",          icon: Package,          label: "Digital Assets",roles: ["SUPER_ADMIN", "MANAGER"], permission: "asset:read", category: "Operations & HR" },
  { href: "/amc",             icon: Clock,            label: "AMC Contracts", roles: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"], permission: "amc:read", category: "Operations & HR" },
  { href: "/service-catalog", icon: Layers,           label: "Service Catalog", roles: ["SUPER_ADMIN", "MANAGER"], permission: "service-catalog:read", category: "Operations & HR" },
  { href: "/reports",         icon: BarChart3,        label: "Reports",       roles: ["SUPER_ADMIN", "MANAGER"], permission: "report:read", category: "Operations & HR" },
  { href: "/resources",       icon: FolderArchive,    label: "Resource Centre",roles: null, permission: null, category: "Operations & HR" },
  { href: "/mailbox",         icon: Mail,             label: "Mailbox",       roles: null, permission: null, category: "Operations & HR" },
  { href: "/users",           icon: Users,            label: "Users",         roles: ["SUPER_ADMIN", "MANAGER"], permission: "user:read", category: "Operations & HR" },
  { href: "/settings",        icon: Cog,              label: "Settings",      roles: ["SUPER_ADMIN", "MANAGER"], permission: "role:read", category: "Operations & HR" },
];

const launchpadAdminNavItems: any[] = [];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  // Staff-only endpoint: skip it on student, client and sign-in pages where the sidebar hides itself.
  const onStaffPage = !/^\/(launchpad(\/|$)|student(\/|$)|login|register|verify-email|forgot-password|reset-password|onboarding|community|set-password|client|meet\/)/.test(pathname || "");
  const { data: profile } = useCompanyProfile({ enabled: isAuthenticated && onStaffPage });
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("norbit_sidebar_collapsed");
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("norbit_sidebar_collapsed", String(next));
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isStudentRoute =
    pathname === "/launchpad" ||
    pathname.startsWith("/launchpad/") ||
    pathname === "/student" ||
    pathname.startsWith("/student/");
  const isAdminLaunchpadRoute =
    pathname === "/launchpad-admin" ||
    pathname.startsWith("/launchpad-admin/");
  const isLaunchpadStudentRoute = isStudentRoute && !isAdminLaunchpadRoute;

  const isCustomerAuthOrMarketing =
    pathname === "/register" ||
    pathname.startsWith("/register") ||
    pathname === "/verify-email" ||
    pathname.startsWith("/verify-email") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding") ||
    pathname === "/community" ||
    pathname.startsWith("/community");

  if (
    !mounted ||
    !isAuthenticated ||
    pathname === "/login" ||
    pathname === "/set-password" ||
    pathname === "/meet" ||
    pathname.startsWith("/meet/") ||
    isLaunchpadStudentRoute ||
    pathname === "/pay" ||
    pathname.startsWith("/pay/") ||
    isCustomerAuthOrMarketing
  ) {
    return null;
  }

  const customerNavItems = [
    { href: "/", label: "Workspace Overview", icon: LayoutDashboard },
    { href: "/projects", label: "Projects & Sprints", icon: FolderKanban },
    { href: "/tasks", label: "Tasks & Backlog", icon: CheckSquare },
    { href: "/tickets", label: "Support Tickets", icon: TicketIcon },
    { href: "/billing", label: "Invoicing & Payments", icon: Receipt },
    { href: "/settings/billing", label: "Plan & Billing", icon: CreditCard },
    { href: "/clients", label: "Clients & Contacts", icon: Building2 },
    { href: "/community", label: "Community & Docs", icon: BookOpen },
  ];

  // Filter navItems based on user role and dynamic permissions
  const userRole = (user as any)?.role as string | undefined;
  const userPermissions = (user as any)?.permissions as string[] | undefined;
  const userType = (user as any)?.userType as string | undefined;

  // isTenantOwner: SaaS customer who registered on norbit.neuravolt.in with MANAGER role
  // They get a full business sidebar but WITHOUT internal-only items (Guardian, Launchpad, Users, HR, Admin)
  const isTenantOwner = userType === 'CUSTOMER' && userRole === 'MANAGER';

  // isLegacyCustomer: old CLIENT role, very limited view
  const isLegacyCustomer = userType === 'CUSTOMER' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER';

  // Paths hidden from tenant SaaS owners (NeuraVolt-internal only)
  const TENANT_BLOCKED_HREFS = new Set([
    "/users",
    "/guardian/overview",
    "/guardian/plans",
    "/guardian",
    "/launchpad-admin",
    "/admin/ai-prompts",
    "/admin/plans",
    "/service-catalog",
  ]);

  const tenantNavItems = allNavItems.filter(item => !TENANT_BLOCKED_HREFS.has(item.href));

  const visibleNavItems = isLegacyCustomer
    ? customerNavItems
    : isTenantOwner
    ? tenantNavItems
    : isAdminLaunchpadRoute
    ? launchpadAdminNavItems
    : allNavItems.filter((item) => {
        if (item.roles === null) return true;
        if (userRole === "SUPER_ADMIN") return true;
        if (item.permission && userPermissions && userPermissions.includes(item.permission)) {
          return true;
        }
        return userRole && item.roles.includes(userRole);
      });

  const checkIsActive = (href: string) => {
    return href === "/"
      ? pathname === "/"
      : href === "/launchpad-admin"
      ? pathname === "/launchpad-admin"
      : href === "/guardian/plans"
      ? pathname === "/guardian/plans" || pathname.startsWith("/guardian/plans/")
      : href === "/guardian/overview"
      ? GUARDIAN_COMMAND_PATHS.filter((p) => p !== "/guardian/plans").some((p) => pathname.startsWith(p))
      : href === "/guardian"
      ? pathname === "/guardian" ||
        (pathname.startsWith("/guardian/") &&
          !pathname.startsWith("/guardian/fleet") &&
          !GUARDIAN_COMMAND_PATHS.some((p) => pathname.startsWith(p)))
      : pathname.startsWith(href);
  };

  return (
    <>
      {/* ── 1. Mobile Top Header Bar (Only visible on screens < md) ── */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-slate-200 shrink-0 z-30 w-full shadow-xs">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 -ml-2 text-slate-700 hover:text-indigo-600 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <Link href="/" className="flex items-center">
          <img src="/norbit-logo.png" alt="nORBIT" className="h-7 w-auto object-contain" />
        </Link>

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-xs">
          {user?.firstName?.charAt(0) || "U"}
        </div>
      </div>

      {/* ── 2. Full-Screen Mobile Drawer (Puri screen par sidebar dikhegi) ── */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col w-full h-full animate-in fade-in duration-200">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0 bg-white">
            <Link href="/" onClick={() => setIsMobileOpen(false)} className="flex flex-col items-start gap-0.5">
              <img src="/norbit-logo.png" alt="nORBIT Logo" className="h-8 w-auto object-contain" />
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">One Platform. Your Entire Business.</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Close Menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Items (Touch-Friendly Full Width) */}
          <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto custom-scrollbar">
            {isAdminLaunchpadRoute && (
              <Link
                href="/"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center px-4 py-3 text-xs font-bold uppercase text-indigo-600 bg-indigo-50/50 rounded-xl mb-2"
              >
                ← Back to Main Platform
              </Link>
            )}
            {visibleNavItems.map(({ href, icon: Icon, label }) => {
              const isActive = checkIsActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl text-base font-semibold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md font-bold"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-indigo-600"
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout in Mobile Drawer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                  {user?.firstName?.charAt(0) || "S"}
                  {user?.lastName?.charAt(0) || "A"}
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {(user as any)?.role?.replace("_", " ") || "SUPER ADMIN"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Desktop Sidebar (Hidden on mobile via hidden md:flex) ── */}
      <div className={`hidden md:flex ${isCollapsed ? "w-[72px]" : "w-64"} bg-white text-slate-800 flex-col transition-all duration-300 ease-in-out h-full shrink-0 relative z-40 border-r border-slate-200 shadow-sm`}>
        
        {/* Floating Edge Collapse Toggle Arrow Button */}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="absolute -right-3.5 top-6 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:text-indigo-600 hover:scale-110 flex items-center justify-center cursor-pointer transition-all z-50"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4 stroke-[2.5]" /> : <ChevronLeft className="w-4 h-4 stroke-[2.5]" />}
        </button>

        {/* Sidebar Header with Logo / Favicon Swap */}
        <div className={`flex items-center ${isCollapsed ? "justify-center px-2 py-5" : "px-5 py-4.5"} border-b border-slate-100 shrink-0 bg-white`}>
          {isCollapsed ? (
            <Link href="/" title="nORBIT Dashboard" className="flex items-center justify-center">
              <img src="/norbit-icon.png" alt="nORBIT Favicon" className="w-10 h-10 object-contain hover:scale-105 transition-transform" />
            </Link>
          ) : (
            <div className="w-full max-w-[175px] flex items-center">
              <img src="/norbit-logo.png" alt="nORBIT Logo" className="w-full max-h-[48px] object-contain" />
            </div>
          )}
        </div>

        {isAdminLaunchpadRoute && !isCollapsed && (
          <Link
            href="/"
            className="flex items-center px-5 py-3 text-xs font-bold uppercase text-indigo-600 hover:bg-indigo-50 transition-colors border-b border-slate-100 shrink-0"
          >
            ← Back to Main Platform
          </Link>
        )}

        {/* Navigation List */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto px-3 custom-scrollbar">
          {visibleNavItems.map(({ href, icon: Icon, label }) => {
            const isActive = checkIsActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={isCollapsed ? label : undefined}
                className={`flex items-center ${isCollapsed ? "justify-center px-0 py-3 rounded-xl" : "px-4 py-2.5 rounded-xl"} text-sm font-medium transition-all group relative ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-200/50 font-bold"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-indigo-600"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isCollapsed ? "" : "mr-3"} ${isActive ? "text-white" : "text-slate-500 group-hover:text-indigo-600"}`} />
                {!isCollapsed && <span className="truncate">{label}</span>}

                {/* Tooltip on collapse hover */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-slate-800">
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer User Avatar Profile */}
        <div className="p-3 border-t border-slate-100 shrink-0 bg-white">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div 
                title={`${user?.firstName} ${user?.lastName} (${(user as any)?.role || "User"})`}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                {user?.firstName?.charAt(0) || "S"}
                {user?.lastName?.charAt(0) || "A"}
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-1">
              <div className="flex items-center overflow-hidden">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                  {user?.firstName?.charAt(0) || "S"}
                  {user?.lastName?.charAt(0) || "A"}
                </div>
                <div className="ml-3 truncate">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                    {(user as any)?.role?.replace("_", " ") || "SUPER ADMIN"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center px-3 py-2 text-xs font-bold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200/60 rounded-xl transition-all gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
