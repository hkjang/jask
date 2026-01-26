import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only handle /api/ routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Get BACKEND_URL from environment or fallback to localhost:4000
    // In Docker execution, BACKEND_URL provided by docker-compose is respected at runtime
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000/api';
    
    // Remove /api prefix to get the path relative to the backend API root
    // Example: /api/auth/login -> /auth/login
    // Docker BACKEND_URL usually includes /api suffix (e.g. http://backend:4000/api)
    // So we append the *relative* path.
    // If BACKEND_URL=".../api", and we append "/auth/login", we get ".../api/auth/login"
    
    // Extract path after /api
    // If pathname isExactly "/api", replacement is empty string.
    const path = request.nextUrl.pathname.replace(/^\/api/, '');
    
    // Construct target URL
    // Ensure we handle potential double slashes
    const targetBase = backendUrl.replace(/\/$/, '');
    const queryString = request.nextUrl.search;
    const targetUrl = targetBase + path + queryString;

    // Rewrite the request to the backend
    return NextResponse.rewrite(new URL(targetUrl));
  }
}

export const config = {
  matcher: '/api/:path*',
};
