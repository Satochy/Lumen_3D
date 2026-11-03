import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  let isProtectedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile')

  if (pathname.startsWith('/marketplace/checkout')) {
    const match = pathname.match(/^\/marketplace\/checkout\/([a-zA-Z0-9_-]+)/)
    const orderId = match ? match[1] : null
    const isUnlocked = orderId
      ? request.cookies.get(`unlocked_order_${orderId}`)?.value === 'true'
      : false

    if (!isUnlocked) {
      isProtectedRoute = true
    }
  }

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}