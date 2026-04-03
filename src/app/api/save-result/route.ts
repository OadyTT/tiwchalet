import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { school, subject, year, score, total, timeUsed, plan, customerId } = body

  if (!school || !subject || score === undefined || !total) {
    return NextResponse.json({ ok: false, error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const sb = getServiceClient()
  const { error } = await sb.from('exam_results').insert({
    school, subject, year: year || '2566',
    score, total,
    pct:         Math.round((score / total) * 100),
    time_used:   timeUsed || 0,
    plan:        plan || 'trial',
    customer_id: customerId || '',   // ← เพิ่ม CustomerID
  })

  if (error) {
    console.error('save-result error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
