import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Rate limiting in-memory — reset ทุก Vercel cold start
// เพียงพอสำหรับ small app (Vercel serverless 1 instance ต่อ region)
const attempts: Record<string, { count: number; resetAt: number }> = {}

// IP-based block list (ถ้าใส่ผิดเกิน 10 ครั้ง block 1 ชั่วโมง)
const blocked: Record<string, number> = {}

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const now = Date.now()

  // Check IP block
  if (blocked[ip] && now < blocked[ip]) {
    const minsLeft = Math.ceil((blocked[ip] - now) / 60000)
    return NextResponse.json(
      { ok: false, error: `ถูกบล็อก ${minsLeft} นาที เนื่องจากใส่รหัสผิดบ่อยเกินไป` },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { pin, type, clientId } = body

  // parent_pin: 4 หลักตัวเลข | full_version_pin: 5 ตัว ตัวอักษร+ตัวเลข
  const isParentPin = type === 'parent'
  const pinPattern  = isParentPin ? /^\d{4}$/ : /^[A-Za-z0-9]{5}$/
  const pinHint     = isParentPin ? '4 หลักตัวเลข' : '5 ตัวอักษร/ตัวเลข'

  if (!pin || typeof pin !== 'string' || !pinPattern.test(pin)) {
    return NextResponse.json({ ok: false, error: `PIN ต้องเป็น ${pinHint}` }, { status: 400 })
  }
  if (!type || !['parent', 'full'].includes(type)) {
    return NextResponse.json({ ok: false, error: 'type ไม่ถูกต้อง' }, { status: 400 })
  }

  // Rate limit ต่อ clientId+type: 5 ครั้ง / 5 นาที
  const key = `${ip}_${clientId || 'x'}_${type}`
  if (!attempts[key] || now > attempts[key].resetAt) {
    attempts[key] = { count: 0, resetAt: now + 5 * 60 * 1000 }
  }
  if (attempts[key].count >= 5) {
    // Block IP 1 ชั่วโมงถ้าผิดเกิน 10 ครั้ง
    const totalFails = attempts[key].count
    if (totalFails >= 10) blocked[ip] = now + 60 * 60 * 1000
    return NextResponse.json(
      { ok: false, error: 'ลองใหม่อีก 5 นาที (ใส่รหัสผิดบ่อยเกินไป)' },
      { status: 429 }
    )
  }

  const sb = getServiceClient()
  const { data: settings, error } = await sb
    .from('settings').select('*').eq('id', 1).single()

  if (error || !settings) {
    return NextResponse.json({ ok: false, error: 'Server error — ตรวจสอบ Supabase' }, { status: 500 })
  }

  const correctPin = type === 'parent' ? settings.parent_pin : settings.full_version_pin

  if (pin !== correctPin) {
    attempts[key].count++
    const remaining = 5 - attempts[key].count
    return NextResponse.json(
      { ok: false, error: `PIN ไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)` },
      { status: 401 }
    )
  }

  // Success — reset attempts
  delete attempts[key]
  delete blocked[ip]

  const token = crypto.randomUUID()
  const expiresAt = new Date(now + 30 * 60 * 1000).toISOString()

  return NextResponse.json({
    ok: true, token, expiresAt, type,
    fullVersionDays: settings.full_version_days,
    settings: type === 'parent' ? {
      childName:         settings.child_name,
      childAvatarUrl:    settings.child_avatar_url,
      childTargetSchool: settings.child_target_school,
      qrCodeImageUrl:    settings.qr_code_image_url,
      adminPhone:        settings.admin_phone,
      adminEmail:        settings.admin_email,
      adminLineId:       settings.admin_line_id,
      fullVersionPrice:  settings.full_version_price,
    } : null,
  })
}
