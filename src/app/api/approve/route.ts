import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// POST /api/approve — admin อนุมัติคำขอ upgrade
// Body: { requestId, action: 'approve'|'reject', adminPin }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { requestId, action, adminPin } = body

  if (!adminPin || !/^[A-Za-z0-9]{4,5}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()

  // ตรวจ admin PIN
  const { data: cfg } = await sb.from('settings').select('parent_pin, full_version_pin, admin_line_id, admin_phone').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
  }

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'requestId และ action จำเป็น' }, { status: 400 })
  }

  // ดึง request
  const { data: req_data } = await sb
    .from('upgrade_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (!req_data) {
    return NextResponse.json({ ok: false, error: 'ไม่พบคำขอนี้' }, { status: 404 })
  }

  // อัพเดตสถานะ
  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  await sb.from('upgrade_requests').update({
    status: newStatus,
    approved_at: new Date().toISOString(),
  }).eq('id', requestId)

  // ส่ง LINE แจ้ง admin (broadcast หรือ push ถ้ามี user ID)
  const lineToken   = process.env.LINE_CHANNEL_TOKEN
  const adminUserId = process.env.LINE_ADMIN_USER_ID

  if (lineToken && adminUserId) {
    const emoji  = action === 'approve' ? '✅' : '❌'
    const label  = action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'
    const msg    = [
      `${emoji} ${label} คำขอ Full Version`,
      '──────────────',
      `👤 ชื่อ: ${req_data.name || '-'}`,
      `📱 ติดต่อ: ${req_data.contact || '-'}`,
      action === 'approve'
        ? `🔑 PIN Full Version: ${cfg.full_version_pin}\nกรุณาส่ง PIN นี้ให้ลูกค้าทาง LINE`
        : `📝 หมายเหตุ: ${body.note || 'ไม่อนุมัติ'}`,
    ].join('\n')

    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
        body: JSON.stringify({ to: adminUserId, messages: [{ type: 'text', text: msg }] }),
      })
    } catch (_) {}
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    message: action === 'approve' ? 'อนุมัติสำเร็จ — แจ้ง LINE admin แล้ว' : 'ปฏิเสธสำเร็จ',
    fullPin: action === 'approve' ? cfg.full_version_pin : undefined,
  })
}

// GET /api/approve — ดูรายการคำขอทั้งหมด (admin only)
export async function GET(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin || !/^[A-Za-z0-9]{4,5}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await sb
    .from('upgrade_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ ok: true, requests: data || [] })
}
