import { NextRequest, NextResponse } from 'next/server'

// ── Middleware — ป้องกัน Admin URL ──────────────────────────────
// Admin URL จริงคือ /admin-[ADMIN_SECRET]
// ถ้าเข้า /admin หรือ secret ผิด → 404
// [adminPath] dynamic route จะ catch ทุก /xxx
// middleware เช็คว่า secret ถูกก่อน render

const ADMIN_SECRET    = process.env.ADMIN_SECRET || 'tc2024'
const ADMIN_REAL_PATH = `/admin-${ADMIN_SECRET}`

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // /admin ตรงๆ → 404 เสมอ
  if (pathname === '/admin' || pathname === '/admin/') {
    return NextResponse.rewrite(new URL('/not-found', req.url))
  }

  // /admin-xxx → ตรวจ secret
  if (pathname.startsWith('/admin-')) {
    if (pathname !== ADMIN_REAL_PATH) {
      return NextResponse.rewrite(new URL('/not-found', req.url))
    }
    // secret ถูก → rewrite ไป [adminPath] route
    return NextResponse.rewrite(new URL('/[adminPath]', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/', '/admin-:path*'],
}
