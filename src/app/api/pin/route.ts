import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Rate limiting
const attempts: Record<string, { count: number; resetAt: number }> = {}
const ipBlock:   Record<string, number> = {}

function checkRate(clientId: string, ip: string): string | null {
  const now = Date.now()
  if (ipBlock[ip] && ipBlock[ip] > now)
    return `IP ถูก block อีก ${Math.ceil((ipBlock[ip]-now)/60000)} นาที`
  const key = `${clientId}:${ip}`
  if (!attempts[key] || attempts[key].resetAt < now)
    attempts[key] = { count: 0, resetAt: now + 5 * 60 * 1000 }
  attempts[key].count++
  if (attempts[key].count > 5) {
    ipBlock[ip] = now + 60 * 60 * 1000
    return 'ลองผิดเกินกำหนด IP ถูก block 1 ชั่วโมง'
  }
  return null
}
function clearRate(clientId: string, ip: string) {
  delete attempts[`${clientId}:${ip}`]
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { pin, type, clientId = 'unknown' } = body
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // ── type กำหนด PIN ที่ต้องใช้ ──────────────────────────
  // parent → parent_pin (4 หลัก) — เข้าโหมดผู้ปกครองในแอป
  // admin  → admin_pin  (6 หลัก) — เข้า admin page
  // full   → full_version_pin (6 หลัก) — ปลดล็อก Full Version
  const validTypes: Record<string, { pattern: RegExp; hint: string; field: string }> = {
    parent: { pattern: /^\d{4}$/, hint: '4 หลักตัวเลข',  field: 'parent_pin' },
    admin:  { pattern: /^\d{6}$/, hint: '6 หลักตัวเลข',  field: 'admin_pin'  },
    full:   { pattern: /^\d{6}$/, hint: '6 หลักตัวเลข',  field: 'full_version_pin' },
  }

  const typeConfig = validTypes[type]
  if (!typeConfig) {
    return NextResponse.json({ ok: false, error: 'type ไม่ถูกต้อง' }, { status: 400 })
  }

  if (!pin || !typeConfig.pattern.test(pin)) {
    return NextResponse.json({
      ok: false,
      error: `PIN ต้องเป็น ${typeConfig.hint}`
    }, { status: 400 })
  }

  const rateErr = checkRate(clientId, ip)
  if (rateErr) return NextResponse.json({ ok: false, error: rateErr }, { status: 429 })

  const sb = getServiceClient()
  const { data: settings, error } = await sb
    .from('settings')
    .select('parent_pin, admin_pin, full_version_pin, full_version_days, child_name, child_avatar_url, child_target_school, full_version_price, parent_name')
    .eq('id', 1)
    .single()

  if (error || !settings) {
    return NextResponse.json({ ok: false, error: 'ไม่สามารถตรวจสอบได้' }, { status: 500 })
  }

  const correctPin = settings[typeConfig.field as keyof typeof settings] as string
  if (pin !== correctPin) {
    const left = Math.max(0, 5 - (attempts[`${clientId}:${ip}`]?.count || 0))
    return NextResponse.json({ ok: false, error: `PIN ไม่ถูกต้อง (เหลือ ${left} ครั้ง)` }, { status: 401 })
  }

  clearRate(clientId, ip)

  // ส่งข้อมูลกลับตาม type
  const token = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const extra: Record<string, any> = { token, _rawPin: pin }

  if (type === 'parent') {
    extra.settings = {
      childName:        settings.child_name,
      childAvatarUrl:   settings.child_avatar_url,
      childTargetSchool:settings.child_target_school,
      fullVersionPrice: settings.full_version_price,
      parentName:       settings.parent_name,
    }
  }
  if (type === 'full') {
    extra.fullVersionDays = settings.full_version_days || 45
  }

  return NextResponse.json({ ok: true, ...extra })
}
