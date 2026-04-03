import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const adminPin   = req.headers.get('x-admin-pin') || ''
  const cronSecret = req.headers.get('x-cron-secret') || ''
  const envCron    = process.env.CRON_SECRET || 'tiwchalet-cron'

  const isValidPin  = /^\d{4,6}$/.test(adminPin)
  const isValidCron = cronSecret === envCron

  if (!isValidPin && !isValidCron) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (isValidPin) {
    const sb2 = getServiceClient()
    const { data: cfg } = await sb2.from('settings').select('parent_pin').eq('id', 1).single()
    if (!cfg || adminPin !== cfg.parent_pin) {
      return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
    }
  }

  const gasUrl = process.env.GAS_ENDPOINT
  if (!gasUrl) {
    return NextResponse.json({ ok: false, error: 'GAS_ENDPOINT ไม่ได้ตั้งค่า' }, { status: 503 })
  }

  const sb = getServiceClient()
  const [resResults, resUpgrades, resQuestions] = await Promise.all([
    sb.from('exam_results').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('upgrade_requests').select('id,name,contact,note,status,amount,created_at,approved_at').order('created_at', { ascending: false }).limit(200),
    sb.from('questions').select('id,school,year,subject,level,text,source,created_at').limit(1000),
  ])

  const now = new Date().toISOString()

  // ── exam_results: เพิ่ม customer_id และ unique_key ──
  const examResultsWithKey = (resResults.data || []).map((r: any) => ({
    unique_key:   `result_${r.id}`,
    customer_id:  r.customer_id || '',      // ← CustomerID จาก device
    backup_time:  now,
    date:         r.created_at?.slice(0, 10) || '',
    time:         r.created_at?.slice(11, 16) || '',
    school:       r.school || '',
    subject:      r.subject || '',
    year:         r.year || '',
    score:        r.score ?? 0,
    total:        r.total ?? 0,
    pct:          r.pct ?? 0,
    time_used:    r.time_used ?? 0,
    plan:         r.plan || 'trial',
  }))

  // ── upgrade_requests: เพิ่ม customer_id ──
  const upgradesWithKey = (resUpgrades.data || []).map((r: any) => ({
    unique_key:   `upgrade_${r.id}`,
    customer_id:  r.contact || '',           // ← ใช้ contact เป็น customer identifier
    backup_time:  now,
    name:         r.name || '',
    contact:      r.contact || '',
    amount:       r.amount || '',
    status:       r.status || 'pending',
    note:         r.note || '',
    created_at:   r.created_at || '',
    approved_at:  r.approved_at || '',
  }))

  const backupData = {
    action:      'fullBackup',
    timestamp:   now,
    examResults: examResultsWithKey,
    upgrades:    upgradesWithKey,
    questions:   resQuestions.data || [],
    counts: {
      results:   examResultsWithKey.length,
      upgrades:  upgradesWithKey.length,
      questions: (resQuestions.data || []).length,
    },
  }

  let gasOk = false; let gasErr = ''
  try {
    const resp = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    })
    gasOk = resp.ok
    if (!resp.ok) gasErr = `GAS ${resp.status}`
  } catch (e: any) { gasErr = e.message }

  try {
    await getServiceClient().from('backup_logs').upsert({
      id: 1,
      last_backup: now,
      rows_results: backupData.counts.results,
      rows_upgrades: backupData.counts.upgrades,
      rows_questions: backupData.counts.questions,
      gas_ok: gasOk,
      note: gasErr || 'success',
    })
  } catch (_) {}

  return NextResponse.json({
    ok: true, gasOk, counts: backupData.counts,
    message: gasOk
      ? `✅ Backup สำเร็จ — ${backupData.counts.results} ผลสอบ · ${backupData.counts.upgrades} คำขอ`
      : `⚠️ ข้อมูลครบ แต่ GAS error: ${gasErr}`,
  })
}

export async function GET(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  let data: any = null
  try { const res = await sb.from('backup_logs').select('*').eq('id', 1).single(); data = res.data } catch (_) {}
  return NextResponse.json({ ok: true, log: data })
}
