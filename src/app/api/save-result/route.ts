import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Save to Supabase
  try {
    const { getServiceClient } = await import('@/lib/supabase')
    const sb = getServiceClient()
    await sb.from('exam_results').insert({
      school: body.school, subject: body.subject, year: body.year,
      score: body.score, total: body.total,
      pct: Math.round(body.score / body.total * 100),
      time_used: body.timeUsed, plan: body.plan || 'trial',
    })
  } catch (_) {}

  // Sync to Google Sheets via GAS (fire-and-forget)
  const gasUrl = process.env.GAS_ENDPOINT
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveResult', ...body }),
      })
    } catch (_) {}
  }

  return NextResponse.json({ ok: true })
}
