import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

const MAX_PDF_MB = 10

// ── Subject detection keywords ────────────────────────────────────
const SUBJECT_PATTERNS: { subject: string; keywords: RegExp }[] = [
  {
    subject: 'คณิตศาสตร์',
    keywords: /คณิตศาสตร์|คณิต|math|mathematics|เลขคณิต|พีชคณิต|เรขาคณิต|สมการ|ลำดับ|ร้อยละ/i,
  },
  {
    subject: 'วิทยาศาสตร์',
    keywords: /วิทยาศาสตร์|วิทย์|science|ฟิสิกส์|เคมี|ชีววิทยา|physics|chemistry|biology/i,
  },
  {
    subject: 'ภาษาไทย',
    keywords: /ภาษาไทย|ภาษา ไทย|ไวยากรณ์|วรรณคดี|วรรณกรรม|การอ่าน|สะกดคำ/i,
  },
  {
    subject: 'English',
    keywords: /english|ภาษาอังกฤษ|grammar|vocabulary|reading|comprehension/i,
  },
  {
    subject: 'สังคมศึกษา',
    keywords: /สังคมศึกษา|สังคม|social|ประวัติศาสตร์|ภูมิศาสตร์|พลเมือง|ศาสนา/i,
  },
]

// ── ตรวจจับวิชาจาก header/context ─────────────────────────────────
function detectSubject(contextText: string): string {
  for (const p of SUBJECT_PATTERNS) {
    if (p.keywords.test(contextText)) return p.subject
  }
  return ''
}

// ── แบ่ง text เป็น sections ตามวิชา ──────────────────────────────
// หา "header" เช่น "วิชาคณิตศาสตร์", "ส่วนที่ 1: ภาษาไทย", "Part 2: English"
function splitBySubject(text: string): { subject: string; text: string }[] {
  const sectionBreak = /(?:^|\n)\s*(?:วิชา|ส่วนที่|ตอนที่|part|section|หมวด)\s*[:\d.]*\s*([^\n]{2,50})/gi
  const sections: { subject: string; start: number }[] = []

  let match
  while ((match = sectionBreak.exec(text)) !== null) {
    const headerText = match[1] || match[0]
    const subject    = detectSubject(headerText)
    if (subject) {
      sections.push({ subject, start: match.index })
    }
  }

  if (sections.length === 0) {
    // ไม่มี section header → return as single block
    return [{ subject: '', text }]
  }

  // แบ่ง text ตาม section
  return sections.map((sec, i) => ({
    subject: sec.subject,
    text:    text.slice(sec.start, sections[i + 1]?.start ?? text.length),
  }))
}

// ── แปลง ans char → index ─────────────────────────────────────────
const ANS_MAP: Record<string, number> = {
  ก: 0, ข: 1, ค: 2, ง: 3,
  a: 0, b: 1, c: 2, d: 3,
  '1': 0, '2': 1, '3': 2, '4': 3,
}
function charToIdx(ch: string): number {
  return ANS_MAP[ch.toLowerCase()] ?? ANS_MAP[ch] ?? -1
}

// ── Core question parser ──────────────────────────────────────────
function parseQuestionsFromText(
  text: string,
  school: string,
  subject: string,
  year: string,
  questionOffset = 0     // ← สำหรับ continue เลขข้อจาก section ก่อนหน้า
): any[] {
  const lines   = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const results: any[] = []

  const qPat   = /^(?:ข้อ\s*)?(\d+)[.)]\s*(.+)/
  const optTh  = /^([กขคง])[.)]\s*(.+)/
  const optNum = /^\(?([1-4])[.)]\s*(.+)/
  const ansPat = /(?:เฉลย|ตอบ|คำตอบ|ans|answer)[:\s]+([กขคงa-d1-4])/i

  let i = 0
  let prevQNum = questionOffset  // ติดตามเลขข้อก่อนหน้าเพื่อ validate

  while (i < lines.length) {
    const qm = lines[i].match(qPat)
    const qNum = qm ? parseInt(qm[1]) : 0

    if (qm && qNum >= 1 && qNum <= 300 && (qNum === prevQNum + 1 || qNum === 1 || prevQNum === 0)) {
      const qText = qm[2].trim()
      const opts: string[] = []
      let ans = -1
      let explain = ''
      let j = i + 1

      // เก็บตัวเลือก
      while (j < lines.length && opts.length < 4) {
        const tm = lines[j].match(optTh)
        const nm = lines[j].match(optNum)
        if      (tm) { opts.push(tm[2].trim());  j++ }
        else if (nm) { opts.push(nm[2].trim());  j++ }
        else if (lines[j].match(qPat))           break
        else { j++ }
      }

      // หาเฉลยและคำอธิบาย
      for (let k = i; k < Math.min(j + 5, lines.length); k++) {
        const am = lines[k].match(ansPat)
        if (am) {
          ans = charToIdx(am[1])
          // ถ้ามีข้อความหลังเฉลยให้เป็น explain
          const rest = lines[k].replace(ansPat, '').trim()
          if (rest.length > 3) explain = rest
          break
        }
      }

      if (qText && opts.length >= 2) {
        while (opts.length < 4) opts.push('')
        results.push({
          text:    qText,
          opt_a:   opts[0], opt_b: opts[1],
          opt_c:   opts[2] || '', opt_d: opts[3] || '',
          opts:    opts.slice(0, 4),
          ans:     ans >= 0 ? ans : 0,
          hasAns:  ans >= 0,
          explain, school, subject, year, level: 'ปานกลาง',
        })
        prevQNum = qNum
      }
      i = j
    } else {
      i++
    }
  }

  return results
}

// ── Main parse — รองรับทั้ง single-subject และ multi-subject ───────
function parseAllQuestions(
  fullText: string,
  defaultSchool: string,
  defaultSubject: string,
  defaultYear: string
): { questions: any[]; subjectGroups: Record<string, number> } {
  const sections = splitBySubject(fullText)
  const allQuestions: any[] = []
  const subjectGroups: Record<string, number> = {}

  for (const sec of sections) {
    const subject = sec.subject || defaultSubject || detectSubject(sec.text) || 'ไม่ระบุ'
    const parsed  = parseQuestionsFromText(sec.text, defaultSchool, subject, defaultYear)

    for (const q of parsed) {
      q.subject = subject
      allQuestions.push(q)
    }

    if (parsed.length > 0) {
      subjectGroups[subject] = (subjectGroups[subject] || 0) + parsed.length
    }
  }

  return { questions: allQuestions, subjectGroups }
}

// ── API Handler ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin || !/^\d{4}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { fileBase64, fileName, school, subject, year, confirmImport, previewData, fileId } = body

  // ── Mode 2: ยืนยัน import ──────────────────────────────────────
  if (confirmImport && previewData && Array.isArray(previewData)) {
    const rows = previewData
      .filter((q: any) => q.text && (q.opt_a || q.opts?.[0]))
      .map((q: any) => ({
        school:  q.school   || school || 'ไม่ระบุ',
        year:    q.year     || year   || '2566',
        subject: q.subject  || subject|| 'ไม่ระบุ',
        level:   q.level    || 'ปานกลาง',
        text:    q.text,
        opt_a:   q.opt_a    || q.opts?.[0] || '',
        opt_b:   q.opt_b    || q.opts?.[1] || '',
        opt_c:   q.opt_c    || q.opts?.[2] || '',
        opt_d:   q.opt_d    || q.opts?.[3] || '',
        ans:     typeof q.ans === 'number' ? q.ans : 0,
        explain: q.explain  || '',
        source:  `pdf:${fileName || fileId || 'upload'}`,
      }))

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'ไม่มีข้อสอบที่จะ import' }, { status: 400 })
    }

    const { data, error } = await sb.from('questions').insert(rows).select('id')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    // สร้างสรุปตามวิชา
    const bySubject: Record<string, number> = {}
    rows.forEach((r: any) => { bySubject[r.subject] = (bySubject[r.subject] || 0) + 1 })
    const summary = Object.entries(bySubject).map(([s, n]) => `${s}: ${n} ข้อ`).join(' · ')

    return NextResponse.json({
      ok: true, status: 'imported',
      imported:     data?.length || rows.length,
      subjectGroups: bySubject,
      message:      `✅ เพิ่มข้อสอบ ${data?.length || rows.length} ข้อ (${summary})`,
    })
  }

  // ── Mode 1: Extract + Parse PDF ────────────────────────────────
  if (!fileBase64) {
    return NextResponse.json({ ok: false, error: 'fileBase64 is required' }, { status: 400 })
  }

  const sizeBytes = (fileBase64.length * 3) / 4
  if (sizeBytes > MAX_PDF_MB * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_PDF_MB}MB` }, { status: 400 })
  }

  let extractedText = ''
  let isScanned = false

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse  = require('pdf-parse') as (buf: Buffer, opt?: any) => Promise<{ text: string; numpages: number }>
    const pdfBuffer = Buffer.from(fileBase64, 'base64')
    const pdfData   = await pdfParse(pdfBuffer, { max: 0 })
    extractedText   = pdfData.text || ''
    if (extractedText.replace(/\s/g, '').length < 50) isScanned = true
  } catch {
    isScanned = true
  }

  if (isScanned) {
    return NextResponse.json({
      ok: true, status: 'scanned',
      message: 'PDF นี้เป็นไฟล์สแกน (ภาพถ่าย) ไม่สามารถอ่านข้อความอัตโนมัติได้',
      howTo:   'กรุณาเปิด PDF แล้วพิมพ์ข้อสอบเองในแท็บ "ข้อสอบ"',
    })
  }

  // Parse — รองรับหลายวิชา
  const { questions, subjectGroups } = parseAllQuestions(
    extractedText, school || '', subject || '', year || '2566'
  )

  if (!questions.length) {
    return NextResponse.json({
      ok: true, status: 'text_only',
      message: 'อ่านข้อความได้แต่ไม่พบรูปแบบข้อสอบที่รู้จัก',
      rawText: extractedText.slice(0, 2000),
      howTo:   'ดูข้อความด้านบนแล้วกรอกข้อสอบเองในแท็บ "ข้อสอบ"',
    })
  }

  // สรุปวิชาที่พบ
  const subjectSummary = Object.entries(subjectGroups).map(([s, n]) => `${s} ${n} ข้อ`).join(', ')
  const multiSubject   = Object.keys(subjectGroups).length > 1

  return NextResponse.json({
    ok:           true,
    status:       'preview',
    fileId:       `pdf_${Date.now()}`,
    total:        questions.length,
    questions,
    subjectGroups,
    multiSubject,
    message:      multiSubject
      ? `พบ ${questions.length} ข้อ จาก ${Object.keys(subjectGroups).length} วิชา (${subjectSummary})`
      : `พบ ${questions.length} ข้อ — ตรวจสอบก่อนยืนยัน`,
  })
}
