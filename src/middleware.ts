import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  })

  const isAuth = !!token
  const userRole = (token as any)?.role
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth")
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin")
  const isApiRoute = request.nextUrl.pathname.startsWith("/api")
  const isPatientRoute = 
    request.nextUrl.pathname.startsWith("/") && 
    !request.nextUrl.pathname.startsWith("/admin") && 
    !request.nextUrl.pathname.startsWith("/auth") && 
    !request.nextUrl.pathname.startsWith("/api") &&
    request.nextUrl.pathname !== "/"

  // If user is on auth page and already logged in, redirect to appropriate dashboard
  if (isAuthPage && isAuth && token) {
    if (userRole === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url))
    }
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Allow access to auth pages and API routes
  if (isAuthPage || isApiRoute) {
    return NextResponse.next()
  }

  // Protect admin routes
  if (isAdminRoute) {
    if (!isAuth || !token || userRole !== "admin") {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
    return NextResponse.next()
  }

  // Protect patient routes (but allow public access to home page)
  if (isPatientRoute && !isAuth) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
