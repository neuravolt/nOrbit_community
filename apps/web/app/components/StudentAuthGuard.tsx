'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStudentAuthStore } from '@/src/store/student-auth';

const PUBLIC_STUDENT_ROUTES = [
  '/launchpad',
  '/launchpad/apply',
  '/launchpad/login',
  '/launchpad/forgot-password',
  '/launchpad/leaderboard',
];

export function StudentAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { student } = useStudentAuthStore();
  
  useEffect(() => {
    // Check if current route is public
    const isPublic = PUBLIC_STUDENT_ROUTES.includes(pathname) ||
      pathname.startsWith('/launchpad/u/');
    
    if (isPublic) {
      setIsLoading(false);
      setIsAuthenticated(true);
      return;
    }
    
    // Check student_token cookie
    const studentToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('student_token='))
      ?.split('=')[1];
    
    if (!studentToken) {
      router.push('/launchpad/login');
      return;
    }

    if (student?.mustChangePassword && pathname !== '/launchpad/change-password') {
      router.push('/launchpad/change-password');
      return;
    }

    if (!student?.mustChangePassword && pathname === '/launchpad/change-password') {
      router.push('/launchpad/dashboard');
      return;
    }
    
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [pathname, router, student]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase">Loading program portal...</span>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  return <>{children}</>;
}
