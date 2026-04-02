import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// ── PDF Import API  v1.1 ───────────────────────────────────────────
// รับ PDF base64 → ส่งไป Claude API → parse ข้อสอบ → บันทึก Supabase
//
// Claude อ่าน PDF ได้โดยตรง (document block) ไม่ต้องแปลงก่อน
// รองรับทั้ง PDF พิมพ์ และ PDF สแกน (Claude มี vision)

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const MAX_PDF_MB   = 10

const SYSTEM_PROMPT = `คุณเป็นผู้เชี่ยวชาญด้านการแปลงข้อสอบไทยจาก PDF
งานของคุณคืออ่าน PDF ที่มีข้อสอบปรนัย แล้วแปลงเป็น JSON array

กฎที่ต้องปฏิบัติอย่างเคร่งครัด:
1. ตอบเป็น JSON array เท่านั้น ห้ามมีข้อความอื่นนำหน้าหรือตามหลัง
2. ไม่ต้องใส่ markdown code block (\`\`\`json)
3. ถ้าหาตัวเลือกหรือเฉลยไม่พบให้ใส่ค่าว่าง
4. ans คือ index 0-3 ของตัวเลือกที่ถูก (0=ก/A, 1=ข/B, 2=ค/C, 3=ง/D)
5. ถ้าไม่รู้เฉลยให้ใส่ -1

รูปแบบ JSON:
[{
  "text": "โจทย์ข้อสอบ",
  "opt_a": "ตัวเลือก ก",
  "opt_b": "ตัวเลือก ข", 
  "opt_c": "ตัวเลือก ค",
  "opt_d": "ตัวเลือก ง",
  "ans": 0,
  "explain": "คำอธิบายเฉลย (ถ้ามี)"
}]`

export async function POST(req: NextRequest) {
  // ── Auth: ต้องมี parent PIN ──
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin || !/^[A-Za-z0-9]{4,5}$/.test(adminPin)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const sb = getServiceClient()
  const { data: settings } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!settings || adminPin !== settings.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ──
  const body = await req.json().catch(() => ({}))
  const { fileBase64, fileName, school, subject, year, confirmImport, previewData, fileId } = body

  // ── Mode 2: ยืนยัน import จาก preview ──
  if (confirmImport && previewData && Array.isArray(previewData)) {
    return await doImport(sb, previewData, { school, subject, year, fileName, fileId })
  }

  // ── Mode 1: Parse PDF ──
  if (!fileBase64) {
    return NextResponse.json({ ok: false, error: 'fileBase64 is required' }, { status: 400 })
  }

  // ตรวจขนาดไฟล์
  const sizeBytes = (fileBase64.length * 3) / 4
  if (sizeBytes > MAX_PDF_MB * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_PDF_MB}MB` }, { status: 400 }
    )
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables' },
      { status: 503 }
    )
  }

  // ── เรียก Claude API ──
  let parsed: any[] = []
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 8000,
        system:     SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type:       'base64',
                media_type: 'application/pdf',
                data:       fileBase64,
              },
            },
            {
              type: 'text',
              text: `ไฟล์นี้คือข้อสอบวิชา "${subject || 'ไม่ระบุ'}" ของโรงเรียน "${school || 'ไม่ระบุ'}" ปี ${year || '2566'}
กรุณาอ่านข้อสอบทั้งหมดในไฟล์แล้วแปลงเป็น JSON array ตามรูปแบบที่กำหนด
ดึงข้อสอบให้ครบทุกข้อที่พบในไฟล์`,
            },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error:', errText)
      return NextResponse.json(
        { ok: false, error: `Claude API error: ${response.status}` }, { status: 502 }
      )
    }

    const aiData   = await response.json()
    const aiText   = aiData.content?.map((c: any) => c.text || '').join('') || ''

    // Parse JSON — ลอง clean ก่อนถ้ามี markdown fence
    const cleaned  = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const arrMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!arrMatch) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบข้อสอบในไฟล์นี้ หรือรูปแบบไม่ถูกต้อง', rawText: aiText.slice(0, 500) },
        { status: 422 }
      )
    }

    parsed = JSON.parse(arrMatch[0])
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบข้อสอบในไฟล์นี้' }, { status: 422 }
      )
    }

    // Normalize
    parsed = parsed.map((q: any, i: number) => ({
      text:    String(q.text    || '').trim(),
      opt_a:   String(q.opt_a  || q.a || '').trim(),
      opt_b:   String(q.opt_b  || q.b || '').trim(),
      opt_c:   String(q.opt_c  || q.c || '').trim(),
      opt_d:   String(q.opt_d  || q.d || '').trim(),
      ans:     typeof q.ans === 'number' ? q.ans : -1,
      explain: String(q.explain || q.explanation || '').trim(),
    })).filter((q: any) => q.text.length > 0)

  } catch (e: any) {
    console.error('Parse error:', e)
    return NextResponse.json(
      { ok: false, error: 'Parse ไม่สำเร็จ: ' + e.message }, { status: 500 }
    )
  }

  // ส่ง preview กลับ รอให้ user ยืนยันก่อน import
  const newFileId = `pdf_${Date.now()}`
  return NextResponse.json({
    ok:       true,
    status:   'preview',
    fileId:   newFileId,
    total:    parsed.length,
    questions: parsed,
  })
}

// ── บันทึกข้อสอบลง Supabase ─────────────────────────────────────
async function doImport(
  sb: any,
  questions: any[],
  meta: { school?: string; subject?: string; year?: string; fileName?: string; fileId?: string }
) {
  const rows = questions.map((q: any) => ({
    school:  meta.school  || 'ไม่ระบุ',
    year:    meta.year    || '2566',
    subject: meta.subject || 'ไม่ระบุ',
    level:   'ปานกลาง',
    text:    q.text,
    opt_a:   q.opt_a || '',
    opt_b:   q.opt_b || '',
    opt_c:   q.opt_c || '',
    opt_d:   q.opt_d || '',
    ans:     typeof q.ans === 'number' && q.ans >= 0 ? q.ans : 0,
    explain: q.explain || '',
    source:  `pdf:${meta.fileName || meta.fileId || 'upload'}`,
  }))

  const { data, error } = await sb.from('questions').insert(rows).select('id')
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok:       true,
    status:   'imported',
    imported: data?.length || rows.length,
    message:  `เพิ่มข้อสอบ ${data?.length || rows.length} ข้อเรียบร้อย`,
  })
}
