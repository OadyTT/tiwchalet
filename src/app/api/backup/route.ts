import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// POST /api/backup — รับ x-admin-pin (parent PIN 4 หลัก) หรือ x-cron-secret
// แล้วส่งข้อมูลไป GAS พร้อม columns เพิ่มเติมเพื่อ track ลูกค้าไม่ให้ซ้ำ
export async function POST(req: NextRequest) {
  const adminPin   = req.headers.get('x-admin-pin') || ''
  const cronSecret = req.headers.get('x-cron-secret') || ''
  const envCron    = process.env.CRON_SECRET || 'tiwchalet-cron'

  // auth: PIN 4 หลักตัวเลข หรือ cron secret
  const isValidPin  = /^\d{4}$/.test(adminPin)
  const isValidCron = cronSecret === envCron

  if (!isValidPin && !isValidCron) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ถ้าเป็น PIN → ตรวจสอบกับ DB
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

  // ดึงข้อมูลจาก Supabase
  const [resResults, resUpgrades, resQuestions] = await Promise.all([
    sb.from('exam_results').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('upgrade_requests').select('id,name,contact,note,status,amount,created_at,approved_at').order('created_at', { ascending: false }).limit(200),
    sb.from('questions').select('id,school,year,subject,level,text,opt_a,opt_b,opt_c,opt_d,ans,source,created_at').limit(1000),
  ])

  // เพิ่ม unique_key ในแต่ละ record เพื่อ dedup ใน Sheets
  const examResultsWithKey = (resResults.data || []).map(r => ({
    ...r,
    unique_key: `result_${r.id}`,    // ← เพิ่ม column นี้สำหรับ dedup
    backup_time: new Date().toISOString(),
  }))

  const upgradesWithKey = (resUpgrades.data || []).map(r => ({
    ...r,
    unique_key: `upgrade_${r.id}`,   // ← เพิ่ม column นี้
    backup_time: new Date().toISOString(),
  }))

  const backupData = {
    action:      'fullBackup',
    timestamp:   new Date().toISOString(),
    examResults: examResultsWithKey,
    upgrades:    upgradesWithKey,
    questions:   resQuestions.data || [],
    counts: {
      results:   examResultsWithKey.length,
      upgrades:  upgradesWithKey.length,
      questions: (resQuestions.data || []).length,
    },
  }

  let gasOk  = false
  let gasErr = ''
  try {
    const resp = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    })
    gasOk = resp.ok
    if (!resp.ok) {
      const txt = await resp.text()
      gasErr = `GAS ${resp.status}: ${txt.slice(0, 200)}`
    }
  } catch (e: any) {
    gasErr = e.message
  }

  // บันทึก backup log
  const sb3 = getServiceClient()
  try {
    await sb3.from('backup_logs').upsert({
      id:            1,
      last_backup:   new Date().toISOString(),
      rows_results:  backupData.counts.results,
      rows_upgrades: backupData.counts.upgrades,
      rows_questions:backupData.counts.questions,
      gas_ok:        gasOk,
      note:          gasErr || 'success',
    })
  } catch (_) {}

  return NextResponse.json({
    ok:     true,
    gasOk,
    counts: backupData.counts,
    message: gasOk
      ? `✅ Backup สำเร็จ — ${backupData.counts.results} ผลสอบ · ${backupData.counts.upgrades} คำขอ · ${backupData.counts.questions} ข้อสอบ`
      : `⚠️ ดึงข้อมูลได้ แต่ส่ง GAS ไม่สำเร็จ: ${gasErr}`,
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
  try {
    const res = await sb.from('backup_logs').select('*').eq('id', 1).single()
    data = res.data
  } catch (_) {}

  return NextResponse.json({ ok: true, log: data })
}
