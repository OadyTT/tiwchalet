import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// ── PDF Import v3 ────────────────────────────────────────────────
// Client อ่าน PDF แล้วส่งแค่ text มา → ประหยัด payload มาก
// ไม่มีขีดจำกัดขนาดไฟล์ฝั่ง server อีกต่อไป

// ── Subject keywords ─────────────────────────────────────────────
const SUBJECT_PATTERNS = [
  { subject:'คณิตศาสตร์', re:/คณิตศาสตร์|คณิต\b|math|algebra|geometry|เลขคณิต|พีชคณิต|เรขาคณิต/i },
  { subject:'วิทยาศาสตร์', re:/วิทยาศาสตร์|วิทย์\b|science|ฟิสิกส์|เคมี|ชีววิทยา|physics|chemistry|biology/i },
  { subject:'ภาษาไทย',    re:/ภาษาไทย|ภาษา ไทย|ไวยากรณ์|วรรณคดี|วรรณกรรม|การอ่าน/i },
  { subject:'English',    re:/english|ภาษาอังกฤษ|grammar|vocabulary|reading comprehension/i },
  { subject:'สังคมศึกษา', re:/สังคมศึกษา|สังคม\b|social|ประวัติศาสตร์|ภูมิศาสตร์|พลเมือง/i },
]

function detectSubject(text: string): string {
  for (const p of SUBJECT_PATTERNS) if (p.re.test(text)) return p.subject
  return ''
}

// ── แบ่ง text เป็น sections ตามวิชา ──────────────────────────────
function splitBySubject(text: string): { subject: string; text: string }[] {
  const breakRe = /(?:^|\n)\s*(?:วิชา|ส่วนที่|ตอนที่|part|section|หมวด)[:\s\d.]*([^\n]{2,60})/gi
  const sections: { subject: string; start: number }[] = []
  let m: RegExpExecArray | null
  while ((m = breakRe.exec(text)) !== null) {
    const subj = detectSubject(m[1] || m[0])
    if (subj) sections.push({ subject: subj, start: m.index })
  }
  if (!sections.length) return [{ subject: '', text }]
  return sections.map((s, i) => ({
    subject: s.subject,
    text:    text.slice(s.start, sections[i + 1]?.start ?? text.length),
  }))
}

// ── Parser ────────────────────────────────────────────────────────
const ANS_MAP: Record<string, number> = { ก:0,ข:1,ค:2,ง:3,a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3 }

function parseSection(text: string, school: string, subject: string, year: string) {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean)
  const results: any[] = []
  const qPat    = /^(?:ข้อ\s*)?(\d+)[.)]\s*(.+)/
  const optThPat = /^([กขคง])[.)]\s*(.+)/
  const optNumPat = /^\(?([1-4])[.)]\s*(.+)/
  const ansPat  = /(?:เฉลย|ตอบ|คำตอบ|ans|answer)[:\s]+([กขคงa-dA-D1-4])/i
  let prevNum = 0, i = 0

  while (i < lines.length) {
    const qm  = lines[i].match(qPat)
    const qNum = qm ? parseInt(qm[1]) : 0
    if (qm && qNum >= 1 && qNum <= 300 && (qNum === prevNum + 1 || qNum === 1 || prevNum === 0)) {
      const qText = qm[2].trim()
      const opts: string[] = []
      let ans = -1, j = i + 1
      while (j < lines.length && opts.length < 4) {
        const tm = lines[j].match(optThPat)
        const nm = lines[j].match(optNumPat)
        if      (tm) { opts.push(tm[2].trim());  j++ }
        else if (nm) { opts.push(nm[2].trim());  j++ }
        else if (lines[j].match(qPat)) break
        else j++
      }
      for (let k = i; k < Math.min(j + 5, lines.length); k++) {
        const am = lines[k].match(ansPat)
        if (am) { ans = ANS_MAP[am[1].toLowerCase()] ?? ANS_MAP[am[1]] ?? -1; break }
      }
      if (qText && opts.length >= 2) {
        while (opts.length < 4) opts.push('')
        results.push({
          text: qText,
          opt_a: opts[0], opt_b: opts[1], opt_c: opts[2]||'', opt_d: opts[3]||'',
          opts: opts.slice(0,4),
          ans: ans >= 0 ? ans : 0, hasAns: ans >= 0,
          explain: '', school, subject, year, level: 'ปานกลาง',
        })
        prevNum = qNum
      }
      i = j
    } else i++
  }
  return results
}

function parseAll(fullText: string, school: string, defaultSubj: string, year: string) {
  const sections = splitBySubject(fullText)
  const questions: any[] = []
  const groups: Record<string, number> = {}
  for (const sec of sections) {
    const subj = sec.subject || defaultSubj || detectSubject(sec.text) || 'ไม่ระบุ'
    const qs   = parseSection(sec.text, school, subj, year)
    qs.forEach(q => { q.subject = subj; questions.push(q) })
    if (qs.length) groups[subj] = (groups[subj] || 0) + qs.length
  }
  return { questions, groups }
}

// ── API ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin || !/^\d{4,6}$/.test(adminPin)) {
    return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 })
  }
  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id',1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok:false, error:'PIN ไม่ถูกต้อง' }, { status:401 })
  }

  const body = await req.json().catch(() => ({}))
  const { pdfText, fileName, school, subject, year, confirmImport, previewData, fileId } = body

  // ── Mode 2: ยืนยัน import ──────────────────────────────────────
  if (confirmImport && previewData?.length) {
    const rows = previewData
      .filter((q: any) => q.text && (q.opt_a || q.opts?.[0]))
      .map((q: any) => ({
        school:  q.school   || school  || 'ไม่ระบุ',
        year:    q.year     || year    || '2566',
        subject: q.subject  || subject || 'ไม่ระบุ',
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
    if (!rows.length) return NextResponse.json({ ok:false, error:'ไม่มีข้อสอบ' }, { status:400 })
    const { data, error } = await sb.from('questions').insert(rows).select('id')
    if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 })
    const bySubj: Record<string,number> = {}
    rows.forEach((r: any) => { bySubj[r.subject] = (bySubj[r.subject]||0)+1 })
    const summary = Object.entries(bySubj).map(([s,n])=>`${s}: ${n} ข้อ`).join(' · ')
    return NextResponse.json({ ok:true, status:'imported', imported:data?.length||rows.length,
      subjectGroups:bySubj, message:`✅ เพิ่ม ${data?.length||rows.length} ข้อ (${summary})` })
  }

  // ── Mode 1: Parse text ──────────────────────────────────────────
  // รับแค่ text (client extract แล้ว) — ไม่มีปัญหาขนาด payload
  if (!pdfText || typeof pdfText !== 'string') {
    return NextResponse.json({ ok:false, error:'pdfText is required — client ต้องอ่าน PDF แล้วส่ง text มา' }, { status:400 })
  }

  if (pdfText.replace(/\s/g,'').length < 30) {
    return NextResponse.json({ ok:true, status:'scanned',
      message:'PDF นี้เป็นไฟล์สแกน (ภาพถ่าย) ไม่สามารถอ่านข้อความได้',
      howTo:'กรุณาพิมพ์ข้อสอบเองในแท็บ "ข้อสอบ"' })
  }

  const { questions, groups } = parseAll(pdfText, school||'', subject||'', year||'2566')
  if (!questions.length) {
    return NextResponse.json({ ok:true, status:'text_only',
      message:'อ่านข้อความได้แต่ไม่พบรูปแบบข้อสอบที่รู้จัก',
      rawText: pdfText.slice(0, 2000),
      howTo:'ดูข้อความแล้วกรอกข้อสอบเองในแท็บ "ข้อสอบ"' })
  }

  const multi = Object.keys(groups).length > 1
  const subjSummary = Object.entries(groups).map(([s,n])=>`${s} ${n} ข้อ`).join(', ')
  return NextResponse.json({ ok:true, status:'preview',
    fileId:`pdf_${Date.now()}`, total:questions.length, questions,
    subjectGroups:groups, multiSubject:multi,
    message: multi
      ? `พบ ${questions.length} ข้อ จาก ${Object.keys(groups).length} วิชา (${subjSummary})`
      : `พบ ${questions.length} ข้อ — ตรวจสอบก่อนยืนยัน` })
}
