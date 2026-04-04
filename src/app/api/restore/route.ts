import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { customerId, mode, adminPin } = body
  if (!customerId) {
    return NextResponse.json({ ok: false, error: 'กรุณาระบุ CustomerID' }, { status: 400 })
  }
  const sb = getServiceClient()
  if (mode === 'admin') {
    if (!adminPin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
    if (!cfg || adminPin !== cfg.parent_pin) {
      return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
    }
  }
  const { data: results, error } = await sb
    .from('exam_results').select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!results?.length) {
    return NextResponse.json({ ok: false,
      error: `ไม่พบข้อมูล CustomerID: ${customerId}`,
      hint: 'ตรวจสอบตัวพิมพ์ใหญ่-เล็กต้องตรงกัน' }, { status: 404 })
  }
  const history = results.map((r: any) => ({
    id: r.id, school: r.school, subject: r.subject, year: r.year,
    score: r.score, total: r.total, pct: r.pct, timeUsed: r.time_used,
    plan: r.plan,
    createdAt: new Date(r.created_at).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'})
  }))
  return NextResponse.json({ ok: true, customerId, count: history.length, history,
    message: `พบประวัติ ${history.length} ชุด` })
}
