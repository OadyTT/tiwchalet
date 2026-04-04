import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { requestId, action, adminPin } = body

  if (!adminPin || !/^\d{6}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()   // ← service_role: ผ่าน RLS ทุก operation

  const { data: cfg } = await sb
    .from('settings')
    .select('admin_pin, full_version_pin')
    .eq('id', 1)
    .single()

  if (!cfg || adminPin !== cfg.admin_pin) {
    return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
  }

  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ ok: false, error: 'requestId และ action จำเป็น' }, { status: 400 })
  }

  // ดึง request ก่อน
  const { data: reqData, error: fetchErr } = await sb
    .from('upgrade_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchErr || !reqData) {
    return NextResponse.json({ ok: false, error: 'ไม่พบคำขอนี้' }, { status: 404 })
  }

  // อัพเดตสถานะ — ใช้ service_role → ผ่าน RLS แน่นอน
  const newStatus = action === 'approve' ? 'approved' : 'rejected'
  const { error: updateErr } = await sb
    .from('upgrade_requests')
    .update({
      status:      newStatus,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateErr) {
    console.error('Update error:', updateErr)
    return NextResponse.json(
      { ok: false, error: 'อัพเดตสถานะไม่สำเร็จ: ' + updateErr.message },
      { status: 500 }
    )
  }

  // ส่ง LINE แจ้ง admin
  const lineToken   = process.env.LINE_CHANNEL_TOKEN
  const adminUserId = process.env.LINE_ADMIN_USER_ID

  if (lineToken && adminUserId) {
    const emoji = action === 'approve' ? '✅' : '❌'
    const label = action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'
    const msg   = [
      `${emoji} ${label} Full Version`,
      '──────────────',
      `👤 ชื่อ: ${reqData.name || '-'}`,
      `📱 ติดต่อ: ${reqData.contact || '-'}`,
      action === 'approve'
        ? `🔑 PIN Full Version: ${cfg.full_version_pin}\n→ ส่ง PIN นี้ให้ลูกค้าทาง LINE`
        : `📝 หมายเหตุ: ปฏิเสธคำขอนี้แล้ว`,
    ].join('\n')

    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
        body:    JSON.stringify({ to: adminUserId, messages: [{ type: 'text', text: msg }] }),
      })
    } catch (_) {}
  }

  return NextResponse.json({
    ok:      true,
    status:  newStatus,
    message: action === 'approve' ? 'อนุมัติสำเร็จ' : 'ปฏิเสธสำเร็จ',
    fullPin: action === 'approve' ? cfg.full_version_pin : undefined,
  })
}

export async function GET(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin || !/^\d{6}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('admin_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.admin_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await sb
    .from('upgrade_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, requests: data || [] })
}
