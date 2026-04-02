import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// POST /api/upload-slip — ผู้ปกครองส่งสลิปชำระเงิน
// แปลงรูปเป็น base64 → เก็บใน Supabase → ส่ง LINE admin
const MAX_IMG_MB = 5

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { imageBase64, mimeType, name, contact, note, amount } = body

  if (!imageBase64 || !name) {
    return NextResponse.json({ ok: false, error: 'imageBase64 และ name จำเป็น' }, { status: 400 })
  }

  // ตรวจขนาด
  const sizeBytes = (imageBase64.length * 3) / 4
  if (sizeBytes > MAX_IMG_MB * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: `รูปใหญ่เกิน ${MAX_IMG_MB}MB` }, { status: 400 })
  }

  const sb = getServiceClient()

  // บันทึกคำขอลง Supabase
  const { data: inserted, error } = await sb
    .from('upgrade_requests')
    .insert({
      name,
      contact:    contact || '',
      note:       note    || '',
      status:     'pending',
      slip_image: imageBase64,    // เก็บ base64 ใน DB (ถ้าเล็ก) หรือใช้ Storage
      amount:     amount  || '',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Insert error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // ส่ง LINE push แจ้ง admin
  const lineToken   = process.env.LINE_CHANNEL_TOKEN
  const adminUserId = process.env.LINE_ADMIN_USER_ID

  if (lineToken && adminUserId) {
    const textMsg = [
      '💳 มีสลิปชำระเงิน Full Version ใหม่!',
      '──────────────',
      `👤 ชื่อ: ${name}`,
      `📱 ติดต่อ: ${contact || '-'}`,
      `💰 จำนวน: ${amount || '-'} บาท`,
      `📝 หมายเหตุ: ${note || '-'}`,
      '──────────────',
      `🔑 Request ID: ${inserted.id}`,
      `กรุณาตรวจสอบสลิปและ approve/reject ใน Admin Page`,
    ].join('\n')

    try {
      // ส่ง text message
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
        body: JSON.stringify({
          to: adminUserId,
          messages: [{ type: 'text', text: textMsg }],
        }),
      })

      // ส่งรูปสลิปถ้ามี (LINE image message ต้องใช้ URL ไม่รับ base64 ตรงๆ)
      // จึงแนบ preview text ว่ามีสลิปใน Supabase แทน
    } catch (_) {}
  }

  return NextResponse.json({
    ok:        true,
    requestId: inserted.id,
    message:   'ส่งสลิปสำเร็จ! Admin จะตรวจสอบและติดต่อกลับภายใน 24 ชั่วโมง',
  })
}
