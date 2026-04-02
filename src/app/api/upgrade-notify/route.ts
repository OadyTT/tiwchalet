import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, contact, note } = body

  // Save to Supabase
  try {
    const { getServiceClient } = await import('@/lib/supabase')
    const sb = getServiceClient()
    await sb.from('upgrade_requests').insert({ name, contact, note })
  } catch (_) {}

  const lineToken   = process.env.LINE_CHANNEL_TOKEN
  const adminUserId = process.env.LINE_ADMIN_USER_ID

  const msg = [
    '🛒 สนใจ Full Version TiwChalet!',
    '──────────────',
    `👤 ชื่อ: ${name || '-'}`,
    `📱 ติดต่อ: ${contact || '-'}`,
    `📝 หมายเหตุ: ${note || '-'}`,
    '──────────────',
    `📧 ${process.env.ADMIN_EMAIL}`,
  ].join('\n')

  // LINE push to admin
  if (lineToken && adminUserId) {
    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
        body: JSON.stringify({ to: adminUserId, messages: [{ type: 'text', text: msg }] }),
      })
    } catch (_) {}
  }

  // Sync to GAS/Sheets
  const gasUrl = process.env.GAS_ENDPOINT
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendSlip', name, contact, note }),
      })
    } catch (_) {}
  }

  return NextResponse.json({ ok: true })
}
