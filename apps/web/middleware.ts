import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public student routes (no auth needed)
  const publicStudentRoutes = [
    '/launchpad',
    '/launchpad/apply',
    '/launchpad/login',
    '/launchpad/forgot-password',
    '/launchpad/leaderboard',
  ];
  
  const isPublicStudentRoute = publicStudentRoutes.includes(pathname) ||
    pathname.startsWith('/launchpad/u/');
  
  // Student protected routes
  const isStudentRoute = (pathname.startsWith('/launchpad/') &&
    !pathname.startsWith('/launchpad-admin')) || pathname.startsWith('/student/');
  
  // Admin LaunchPad routes
  const isAdminLaunchpadRoute = pathname.startsWith('/launchpad-admin');
  
  // API routes (handled by NestJS)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Public routes — allow
  if (isPublicStudentRoute) {
    return NextResponse.next();
  }
  
  // Student protected routes — check student_token
  if (isStudentRoute) {
    const studentToken = request.cookies.get('student_token')?.value;
    
    if (!studentToken) {
      return NextResponse.redirect(new URL('/launchpad/login', request.url));
    }
    
    return NextResponse.next();
  }
  
  // Admin LaunchPad routes — check token (STAFF)
  if (isAdminLaunchpadRoute) {
    const token = request.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    return NextResponse.next();
  }
  
  // Default: pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/launchpad/:path*',
    '/launchpad-admin/:path*',
    '/student/:path*',
    // Don't match API routes or static files
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
