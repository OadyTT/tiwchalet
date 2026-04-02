import { NextRequest, NextResponse } from 'next/server'

// ── Middleware v1.0 — ป้องกัน /admin ด้วย Secret Path ──
// Admin URL จริงคือ /admin-[ADMIN_SECRET] เช่น /admin-tc2024
// ถ้าเข้า /admin ตรงๆ → redirect ไป 404

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'tc2024'
const ADMIN_REAL_PATH = `/admin-${ADMIN_SECRET}`

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ถ้าเข้า /admin ตรงๆ (ไม่มี secret) → 404
  if (pathname === '/admin' || pathname === '/admin/') {
    return NextResponse.rewrite(new URL('/not-found', req.url))
  }

  // ถ้าเข้า /admin-WRONG_SECRET → 404
  if (pathname.startsWith('/admin-') && pathname !== ADMIN_REAL_PATH) {
    return NextResponse.rewrite(new URL('/not-found', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/', '/admin-:path*'],
}
