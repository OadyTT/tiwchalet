import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// POST /api/backup — backup ข้อมูลไป Google Sheets ผ่าน GAS
// ใช้ได้ทั้ง manual (parent กดปุ่ม) และ auto (cron จาก Vercel)
export async function POST(req: NextRequest) {
  // Auth — parent PIN หรือ cron secret
  const adminPin    = req.headers.get('x-admin-pin') || ''
  const cronSecret  = req.headers.get('x-cron-secret') || ''
  const envCron     = process.env.CRON_SECRET || 'tiwchalet-cron'

  const isAuthed = (adminPin && /^[A-Za-z0-9]{4,5}$/.test(adminPin)) || cronSecret === envCron
  if (!isAuthed) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ถ้าเป็น parent PIN ตรวจสอบก่อน
  if (adminPin) {
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

  // ดึงข้อมูลจาก Supabase
  const [resResults, resUpgrades, resQuestions] = await Promise.all([
    sb.from('exam_results').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('upgrade_requests').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('questions').select('id,school,year,subject,level,text,opt_a,opt_b,opt_c,opt_d,ans,source,created_at').limit(1000),
  ])

  const backupData = {
    action:        'fullBackup',
    timestamp:     new Date().toISOString(),
    examResults:   resResults.data   || [],
    upgrades:      resUpgrades.data  || [],
    questions:     resQuestions.data || [],
    counts: {
      results:   (resResults.data   || []).length,
      upgrades:  (resUpgrades.data  || []).length,
      questions: (resQuestions.data || []).length,
    },
  }

  // ส่งไป GAS
  let gasOk = false
  let gasErr = ''
  try {
    const resp = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    })
    gasOk = resp.ok
    if (!resp.ok) gasErr = `GAS status: ${resp.status}`
  } catch (e: any) {
    gasErr = e.message
  }

  // บันทึก backup log ลง Supabase
  try {
    await sb.from('backup_logs').upsert({
      id:            1,
      last_backup:   new Date().toISOString(),
      rows_results:  backupData.counts.results,
      rows_upgrades: backupData.counts.upgrades,
      rows_questions:backupData.counts.questions,
      gas_ok:        gasOk,
      note:          gasErr || 'success',
    })
  } catch (_) {} // ไม่ error ถ้า table ยังไม่มี

  return NextResponse.json({
    ok:    true,
    gasOk,
    counts: backupData.counts,
    message: gasOk
      ? `Backup สำเร็จ — ส่ง ${backupData.counts.results + backupData.counts.upgrades + backupData.counts.questions} records ไป Google Sheets`
      : `ส่งข้อมูลได้แต่ GAS error: ${gasErr}`,
  })
}

// GET /api/backup — ดูสถานะ backup ล่าสุด
export async function GET(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let data: any = null
  try {
    const res = await sb.from('backup_logs').select('*').eq('id', 1).single()
    data = res.data
  } catch (_) {}
  return NextResponse.json({ ok: true, log: data })
}
