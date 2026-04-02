import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// GET: ส่งเฉพาะ settings ที่ frontend ต้องการ (ไม่ส่ง PIN ออกมา)
export async function GET() {
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('settings').select('*').eq('id', 1).single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Settings not found' }, { status: 404 })
  }

  // *** ไม่ส่ง PIN ออกมาใน GET ***
  const safe = {
    full_version_days:    data.full_version_days,
    full_version_price:   data.full_version_price,
    full_version_enabled: data.full_version_enabled,
    qr_code_image_url:    data.qr_code_image_url,
    child_name:           data.child_name,
    child_avatar_url:     data.child_avatar_url,
    child_target_school:  data.child_target_school,
    admin_phone:          data.admin_phone,
    admin_email:          data.admin_email,
    admin_line_id:        data.admin_line_id,
  }
  return NextResponse.json({ ok: true, settings: safe })
}

// GET with admin auth: ส่งข้อมูลเต็ม รวม PIN (สำหรับ admin page)
export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get('x-admin-pin') || ''
  if (!authHeader || !/^\d{4}$/.test(authHeader)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const { data: current } = await sb
    .from('settings').select('parent_pin').eq('id', 1).single()

  if (!current || authHeader !== current.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ส่ง full settings (รวม PIN) ให้ admin page
  const { data } = await sb.from('settings').select('*').eq('id', 1).single()
  return NextResponse.json({ ok: true, settings: data })
}

// POST: อัพเดต settings (ต้องมี PIN)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('x-admin-pin') || ''
  if (!authHeader || !/^\d{4}$/.test(authHeader)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const { data: current } = await sb
    .from('settings').select('parent_pin').eq('id', 1).single()

  if (!current || authHeader !== current.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const allowed = [
    'parent_pin', 'full_version_pin', 'full_version_days', 'full_version_price',
    'full_version_enabled', 'qr_code_image_url', 'child_name', 'child_avatar_url',
    'child_target_school', 'admin_phone', 'admin_email', 'admin_line_id',
  ]
  const updates: Record<string, any> = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      // Validate PIN fields
      if ((k === 'parent_pin' || k === 'full_version_pin') &&
          (typeof body[k] !== 'string' || !/^\d{4}$/.test(body[k]))) {
        return NextResponse.json(
          { ok: false, error: `${k} ต้องเป็นตัวเลข 4 หลัก` }, { status: 400 }
        )
      }
      updates[k] = body[k]
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: false, error: 'ไม่มีข้อมูลที่จะอัพเดต' }, { status: 400 })
  }

  const { error } = await sb.from('settings').update(updates).eq('id', 1)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
