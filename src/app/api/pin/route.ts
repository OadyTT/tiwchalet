import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Rate limiting ด้วย in-memory (เพียงพอสำหรับ small app)
const attempts: Record<string, { count: number; resetAt: number }> = {}

export async function POST(req: NextRequest) {
  const { pin, type, clientId } = await req.json()

  if (!pin || pin.length !== 4) {
    return NextResponse.json({ ok: false, error: 'PIN ต้อง 4 หลัก' }, { status: 400 })
  }

  // Rate limit: 5 ครั้ง / 5 นาที
  const key = `${clientId}_${type}`
  const now = Date.now()
  if (!attempts[key] || now > attempts[key].resetAt) {
    attempts[key] = { count: 0, resetAt: now + 5 * 60 * 1000 }
  }
  if (attempts[key].count >= 5) {
    return NextResponse.json({ ok: false, error: 'ลองใหม่อีก 5 นาที (ผิดบ่อยเกินไป)' }, { status: 429 })
  }

  const supabase = getServiceClient()
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()

  if (!settings) {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }

  const correctPin = type === 'parent' ? settings.parent_pin : settings.full_version_pin

  if (pin !== correctPin) {
    attempts[key].count++
    return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
  }

  // Success
  attempts[key].count = 0
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  return NextResponse.json({
    ok: true,
    token,
    expiresAt,
    type,
    fullVersionDays: settings.full_version_days,
    settings: type === 'parent' ? {
      childName:        settings.child_name,
      childAvatarUrl:   settings.child_avatar_url,
      childTargetSchool:settings.child_target_school,
      qrCodeImageUrl:   settings.qr_code_image_url,
      adminPhone:       settings.admin_phone,
      adminEmail:       settings.admin_email,
      adminLineId:      settings.admin_line_id,
      fullVersionPrice: settings.full_version_price,
    } : null,
  })
}
