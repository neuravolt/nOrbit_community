"use client";

import { useAuthStore } from "@/src/store/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ShieldX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { ForcePasswordChange } from "./ForcePasswordChange";

/** Pages anyone can open without signing in. */
const PUBLIC_PAGES = [
  "/",
  "/community",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/set-password",
];

// ─── Route → Allowed Roles Map ───────────────────────────────────────────────
// Order matters: more specific paths before generic prefixes
const ROUTE_ROLES: Array<{ prefix: string; roles: string[]; permission?: string }> = [
  { prefix: "/meetings",     roles: ["SUPER_ADMIN", "MANAGER", "SALES", "DEVELOPER"], permission: "meeting:read" },
  { prefix: "/users",        roles: ["SUPER_ADMIN", "MANAGER"], permission: "user:read" },
  { prefix: "/hr",           roles: ["SUPER_ADMIN", "MANAGER"], permission: "hr:read" },
  { prefix: "/settings",     roles: ["SUPER_ADMIN", "MANAGER"], permission: "role:read" },
  { prefix: "/reports",      roles: ["SUPER_ADMIN", "MANAGER"], permission: "report:read" },
  { prefix: "/billing",      roles: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"], permission: "invoice:read" },
  { prefix: "/accounting",   roles: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"], permission: "accounting:read" },
  { prefix: "/amc",          roles: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT"], permission: "amc:read" },
  { prefix: "/sales",        roles: ["SUPER_ADMIN", "MANAGER", "SALES"], permission: "quote:read" },
  { prefix: "/leads",        roles: ["SUPER_ADMIN", "MANAGER", "SALES"], permission: "lead:read" },
  { prefix: "/clients",      roles: ["SUPER_ADMIN", "MANAGER", "SALES", "DEVELOPER"], permission: "client:read" },
  { prefix: "/projects",     roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA"], permission: "project:read" },
  { prefix: "/tasks",        roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA"], permission: "task:read" },
  { prefix: "/tickets",      roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA", "SUPPORT"], permission: "ticket:read" },
  { prefix: "/assets",       roles: ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA"], permission: "asset:read" },
  { prefix: "/service-catalog", roles: ["SUPER_ADMIN", "MANAGER"], permission: "service-catalog:read" },
  { prefix: "/admin",        roles: ["SUPER_ADMIN", "MANAGER"], permission: "launchpad:read" },
];

function getRequiredRouteConfig(pathname: string) {
  for (const item of ROUTE_ROLES) {
    if (pathname === item.prefix || pathname.startsWith(item.prefix + "/")) {
      return item;
    }
  }
  return null; // Dashboard "/" and public routes — no restriction
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user: cachedUser, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Fetch fresh user profile on every session mount
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      return data;
    },
    enabled: !!isAuthenticated && mounted,
  });

  // Sync fresh user data (role, permissions, name, email) into the store
  useEffect(() => {
    if (isAuthenticated && currentUser && cachedUser) {
      const changed =
        currentUser.email !== cachedUser.email ||
        currentUser.firstName !== cachedUser.firstName ||
        currentUser.lastName !== cachedUser.lastName ||
        currentUser.role !== cachedUser.role ||
        currentUser.userType !== cachedUser.userType ||
        currentUser.activeOrganizationId !== (cachedUser as any).activeOrganizationId ||
        JSON.stringify(currentUser.permissions) !== JSON.stringify(cachedUser.permissions);
      if (changed) {
        setUser({
          ...cachedUser,
          email: currentUser.email,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          role: currentUser.role,
          roles: currentUser.roles,
          permissions: currentUser.permissions,
          userType: currentUser.userType,
          activeOrganizationId: currentUser.activeOrganizationId,
        } as any);
      }
    }
  }, [isAuthenticated, currentUser, cachedUser, setUser]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const isStudentRoute =
      pathname === "/launchpad" ||
      pathname.startsWith("/launchpad/") ||
      pathname === "/student" ||
      pathname.startsWith("/student/") ||
      pathname === "/meet" ||
      pathname.startsWith("/meet/") ||
      pathname === "/launchpad-partner" ||
      pathname.startsWith("/launchpad-partner/");

    if (isStudentRoute) return;

    if (pathname === "/set-password") return;
    if (pathname === "/pay" || pathname.startsWith("/pay/")) return;

    const isPublicPage =
      PUBLIC_PAGES.includes(pathname) ||
      pathname.startsWith("/verify-email") ||
      pathname.startsWith("/reset-password") ||
      pathname.startsWith("/community");

    if (isPublicPage) {
      if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
        router.replace("/");
        return;
      }
      return;
    }

    // Customer Workspace Plane (Dual-Plane)
    // CUSTOMER + MANAGER = SaaS tenant owner → allow full business suite (not Guardian/Launchpad/Admin)
    // CUSTOMER + other restricted roles = limited to basic paths only
    if (isAuthenticated && (cachedUser as any)?.userType === 'CUSTOMER' && (cachedUser as any)?.role !== 'SUPER_ADMIN') {
      const customerRole = (cachedUser as any)?.role;

      // Tenant workspace owners (MANAGER role) get access to full business suite
      // but NOT internal-only paths like /guardian, /launchpad-admin, /admin, /users, /hr
      const isTenantOwner = customerRole === 'MANAGER';

      // Paths always blocked for ALL customer types (internal NeuraVolt tools only)
      const isInternalOnlyPath =
        pathname === "/users" || pathname.startsWith("/users/") ||
        (pathname.startsWith("/guardian") && !pathname.startsWith("/guardian/fleet")) ||
        pathname === "/launchpad-admin" || pathname.startsWith("/launchpad-admin/") ||
        pathname === "/admin" || pathname.startsWith("/admin/") ||
        pathname === "/service-catalog" || pathname.startsWith("/service-catalog/");

      // Auth & public paths always allowed
      const isAuthPath =
        pathname === "/register" || pathname === "/login" ||
        pathname === "/verify-email" || pathname.startsWith("/verify-email") ||
        pathname === "/forgot-password" ||
        pathname === "/reset-password" || pathname.startsWith("/reset-password") ||
        pathname === "/onboarding" || pathname.startsWith("/onboarding/") ||
        pathname === "/community" || pathname.startsWith("/community/");

      if (isAuthPath) {
        setAccessDenied(false);
        return;
      }

      if (isInternalOnlyPath) {
        setAccessDenied(true);
        return;
      }

      if (isTenantOwner) {
        // Full business suite access for tenant owners
        setAccessDenied(false);
      } else {
        // Legacy CLIENT role or other restricted customer roles: basic paths only
        const isAllowedBasicPath =
          pathname === "/" ||
          pathname === "/projects" || pathname.startsWith("/projects/") ||
          pathname === "/tasks" || pathname.startsWith("/tasks/") ||
          pathname === "/tickets" || pathname.startsWith("/tickets/") ||
          pathname === "/billing" || pathname.startsWith("/billing/") ||
          pathname === "/settings/billing" || pathname.startsWith("/settings/billing/") ||
          pathname === "/clients" || pathname.startsWith("/clients/");
        setAccessDenied(!isAllowedBasicPath);
      }
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    // Role and Permissions-based route blocking for staff
    if (isAuthenticated) {
      const userRole = (cachedUser as any)?.role;
      const userPermissions = (cachedUser as any)?.permissions as string[] | undefined;
      const routeConfig = getRequiredRouteConfig(pathname);

      if (routeConfig) {
        if (userRole === "SUPER_ADMIN") {
          setAccessDenied(false);
        } else {
          // Check dynamic permission
          const hasPerm = routeConfig.permission && userPermissions && userPermissions.includes(routeConfig.permission);
          const hasRoleFallback = userRole && routeConfig.roles.includes(userRole);
          
          if (hasPerm || hasRoleFallback) {
            setAccessDenied(false);
          } else {
            setAccessDenied(true);
          }
        }
      } else {
        setAccessDenied(false);
      }
    }
  }, [isAuthenticated, pathname, router, mounted, cachedUser]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isStudentRoute =
    pathname === "/launchpad" ||
    pathname.startsWith("/launchpad/") ||
    pathname === "/student" ||
    pathname.startsWith("/student/") ||
    pathname === "/meet" ||
    pathname.startsWith("/meet/") ||
    pathname === "/launchpad-partner" ||
    pathname.startsWith("/launchpad-partner/");

  const isPayRoute = pathname === "/pay" || pathname.startsWith("/pay/");
  if (pathname === "/set-password" || isPayRoute) return <>{children}</>;

  // A new employee still on HR's one-time password sets their own before anything else.
  if (isAuthenticated && !isStudentRoute && (currentUser?.mustChangePassword || (cachedUser as any)?.mustChangePassword)) {
    return <ForcePasswordChange />;
  }

  const isPublicPage =
    PUBLIC_PAGES.includes(pathname) ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/community");

  if (!isAuthenticated && !isPublicPage && !isStudentRoute && !isPayRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && pathname === "/login" && !isStudentRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Access Denied Page — shown when role is insufficient
  if (accessDenied) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500 text-sm mb-6">
            You don&apos;t have permission to view this page. Contact your administrator if you
            believe this is an error.
          </p>
          <button
            onClick={() => {
              setAccessDenied(false);
              router.replace("/");
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
