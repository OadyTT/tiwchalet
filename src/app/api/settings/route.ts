import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET() {
  const sb = getServiceClient()
  const { data } = await sb.from('settings').select('*').eq('id', 1).single()
  return NextResponse.json({ ok: true, settings: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Validate admin token (simple approach: check parent PIN in header)
  const authHeader = req.headers.get('x-admin-pin') || ''
  const sb = getServiceClient()
  const { data: current } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!current || authHeader !== current.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Update only allowed fields
  const allowed = [
    'parent_pin', 'full_version_pin', 'full_version_days', 'full_version_price',
    'full_version_enabled', 'qr_code_image_url', 'child_name', 'child_avatar_url',
    'child_target_school', 'admin_phone', 'admin_email', 'admin_line_id',
  ]
  const updates: Record<string, any> = {}
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k]
  }

  await sb.from('settings').update(updates).eq('id', 1)
  return NextResponse.json({ ok: true })
}
