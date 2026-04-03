import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// ── PDF Import v2 — ไม่ใช้ Anthropic API ────────────────────────
// ใช้ pdf-parse extract text แล้ว parse pattern เอง
// รองรับ PDF พิมพ์จากคอมพิวเตอร์ (text-selectable)
// PDF สแกน → แจ้ง user ให้กรอกเอง

const MAX_PDF_MB = 10

// ── Pattern parser ────────────────────────────────────────────────
// รองรับรูปแบบข้อสอบไทยหลายแบบ:
// "1. โจทย์\nก. ก\nข. ข\nค. ค\nง. ง\nเฉลย ก"
// "ข้อ 1) โจทย์\n1) ก\n2) ข\n3) ค\n4) ง\nตอบ 1"
function parseQuestions(text: string, school: string, subject: string, year: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const questions: any[] = []

  // regex patterns
  const qPat   = /^(?:ข้อ\s*)?(\d+)[.)]\s*(.+)/
  const optTh  = /^([กขคง])[.)]\s*(.+)/
  const optNum = /^\(?([1-4])[.)]\s*(.+)/
  const ansPat = /(?:เฉลย|ตอบ|คำตอบ|ans)[:\s]*([กขคง1-4])/i
  const ansMap: Record<string,number> = { ก:0, ข:1, ค:2, ง:3, '1':0, '2':1, '3':2, '4':3 }

  let i = 0
  while (i < lines.length) {
    const qm = lines[i].match(qPat)
    if (qm && parseInt(qm[1]) >= 1 && parseInt(qm[1]) <= 200) {
      const text = qm[2].trim()
      const opts: string[] = []
      let ans = -1
      let j = i + 1

      // collect options
      while (j < lines.length && opts.length < 4) {
        const tm = lines[j].match(optTh)
        const nm = lines[j].match(optNum)
        if (tm)  { opts.push(tm[2].trim());  j++ }
        else if (nm) { opts.push(nm[2].trim()); j++ }
        else if (lines[j].match(qPat)) break  // next question
        else { j++ }
      }

      // find answer in surrounding lines
      for (let k = i; k < Math.min(j + 3, lines.length); k++) {
        const am = lines[k].match(ansPat)
        if (am) {
          ans = ansMap[am[1].toUpperCase() === 'ก' ? 'ก' : am[1].toUpperCase() === 'ข' ? 'ข' : am[1].toUpperCase() === 'ค' ? 'ค' : am[1].toUpperCase() === 'ง' ? 'ง' : am[1]] ?? -1
          break
        }
      }

      if (text && opts.length >= 2) {
        while (opts.length < 4) opts.push('')
        questions.push({
          text, opts: opts.slice(0, 4),
          opt_a: opts[0], opt_b: opts[1], opt_c: opts[2] || '', opt_d: opts[3] || '',
          ans: ans >= 0 ? ans : 0,
          explain: '', school, subject, year, level: 'ปานกลาง',
        })
      }
      i = j
    } else { i++ }
  }
  return questions
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin || !/^\d{4}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized — ต้องใส่ PIN 4 หลัก' }, { status: 401 })
  }

  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const { fileBase64, fileName, school, subject, year, confirmImport, previewData, fileId } = body

  // ── Mode 2: ยืนยัน import ─────────────────────────────────────
  if (confirmImport && previewData && Array.isArray(previewData)) {
    const rows = previewData.filter((q: any) => q.text && q.opt_a).map((q: any) => ({
      school:  school || q.school  || 'ไม่ระบุ',
      year:    year   || q.year    || '2566',
      subject: subject|| q.subject || 'ไม่ระบุ',
      level:   q.level|| 'ปานกลาง',
      text:    q.text, opt_a: q.opt_a || q.opts?.[0] || '',
      opt_b:   q.opt_b|| q.opts?.[1] || '', opt_c: q.opt_c || q.opts?.[2] || '',
      opt_d:   q.opt_d|| q.opts?.[3] || '', ans: typeof q.ans==='number'?q.ans:0,
      explain: q.explain || '',
      source:  `pdf:${fileName || fileId || 'upload'}`,
    }))

    const { data, error } = await sb.from('questions').insert(rows).select('id')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true, status: 'imported',
      imported: data?.length || rows.length,
      message: `✅ เพิ่มข้อสอบ ${data?.length || rows.length} ข้อเรียบร้อยแล้ว`,
    })
  }

  // ── Mode 1: Extract text from PDF ─────────────────────────────
  if (!fileBase64) {
    return NextResponse.json({ ok: false, error: 'fileBase64 is required' }, { status: 400 })
  }

  const sizeBytes = (fileBase64.length * 3) / 4
  if (sizeBytes > MAX_PDF_MB * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_PDF_MB}MB` }, { status: 400 })
  }

  // Extract text using pdf-parse
  let extractedText = ''
  let isScanned = false

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse  = require('pdf-parse') as (buf: Buffer, opt?: any) => Promise<{text:string;numpages:number}>
    const pdfBuffer = Buffer.from(fileBase64, 'base64')
    const pdfData   = await pdfParse(pdfBuffer, { max: 0 })
    extractedText   = pdfData.text || ''

    // ตรวจว่าเป็นสแกน (text น้อยกว่า 50 ตัวอักษร)
    if (extractedText.replace(/\s/g, '').length < 50) {
      isScanned = true
    }
  } catch (e: any) {
    console.error('PDF parse error:', e.message)
    // ถ้า parse ไม่ได้ อาจเป็นสแกน หรือ PDF เสีย
    isScanned = true
  }

  // ── PDF สแกน ────────────────────────────────────────────────
  if (isScanned) {
    return NextResponse.json({
      ok: true, status: 'scanned',
      message: 'PDF นี้เป็นไฟล์สแกน (ภาพถ่าย) ไม่สามารถอ่านข้อความอัตโนมัติได้',
      howTo: 'กรุณาเปิด PDF แล้วพิมพ์ข้อสอบเองในแท็บ "ข้อสอบ"',
      textFound: extractedText.length,
    })
  }

  // ── Parse questions ──────────────────────────────────────────
  const parsed = parseQuestions(extractedText, school || '', subject || '', year || '2566')

  if (!parsed.length) {
    // text อ่านได้แต่ parse pattern ไม่ตรง — ส่ง raw text กลับมาให้ดู
    return NextResponse.json({
      ok: true, status: 'text_only',
      message: 'อ่านข้อความได้แต่ไม่พบรูปแบบข้อสอบที่รู้จัก',
      rawText: extractedText.slice(0, 2000),
      howTo: 'ดูข้อความด้านบนแล้วกรอกข้อสอบเองในแท็บ "ข้อสอบ"',
    })
  }

  // ── ส่ง preview กลับ ────────────────────────────────────────
  const newFileId = `pdf_${Date.now()}`
  return NextResponse.json({
    ok: true, status: 'preview',
    fileId:    newFileId,
    total:     parsed.length,
    questions: parsed,
    message:   `พบข้อสอบ ${parsed.length} ข้อ — ตรวจสอบก่อนยืนยัน`,
  })
}
