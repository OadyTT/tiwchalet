import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Static fallback questions (Thai + Sci + Math + English)
// โรงเรียน + ปี + วิชา ครบถ้วน ตรงตามจริง
const STATIC_QUESTIONS = [
  // ── คณิตศาสตร์ ──────────────────────────────────────────
  { id:'M01', school:'สวนกุหลาบ',   year:'2566', subject:'คณิตศาสตร์', level:'ปานกลาง',
    text:'ถ้า 3x + 5 = 20 แล้ว x มีค่าเท่าใด', opts:['3','4','5','6'], ans:2, explain:'3x=15 → x=5' },
  { id:'M02', school:'สวนกุหลาบ',   year:'2566', subject:'คณิตศาสตร์', level:'ยาก',
    text:'สี่เหลี่ยมจัตุรัสพื้นที่ 144 ตร.ซม. ด้านยาวเท่าใด', opts:['10','11','12','13'], ans:2, explain:'√144=12' },
  { id:'M03', school:'สวนกุหลาบ',   year:'2566', subject:'คณิตศาสตร์', level:'ง่าย',
    text:'เลขจำนวนคี่ระหว่าง 10 ถึง 20 มีกี่จำนวน', opts:['3','4','5','6'], ans:2, explain:'11,13,15,17,19 = 5 จำนวน' },
  { id:'M04', school:'สามเสน',       year:'2566', subject:'คณิตศาสตร์', level:'ปานกลาง',
    text:'ร้อยละ 15 ของ 200 เท่ากับเท่าใด', opts:['20','25','30','35'], ans:2, explain:'200×0.15=30' },
  { id:'M05', school:'สามเสน',       year:'2566', subject:'คณิตศาสตร์', level:'ยาก',
    text:'ลำดับ 2, 5, 10, 17, ... จำนวนถัดไปคือ', opts:['24','26','28','30'], ans:1, explain:'ผลต่าง +3,+5,+7,+9 → 26' },
  { id:'M06', school:'สาธิตจุฬา',    year:'2566', subject:'คณิตศาสตร์', level:'ยากมาก',
    text:'2ⁿ < 100  ค่า n เต็มบวกมากที่สุดคือ', opts:['5','6','7','8'], ans:1, explain:'2⁶=64<100, 2⁷=128>100' },
  { id:'M07', school:'บดินทรเดชา',  year:'2566', subject:'คณิตศาสตร์', level:'ปานกลาง',
    text:'สามเหลี่ยมมุมฉากด้านประกอบ 6 และ 8 ซม. ด้านตรงข้ามมุมฉากยาวเท่าใด', opts:['9','10','11','12'], ans:1, explain:'√(36+64)=10' },
  { id:'M08', school:'หอวัง',        year:'2566', subject:'คณิตศาสตร์', level:'ง่าย',
    text:'ซื้อของ 240 บาท จ่าย 300 บาท ทอนกี่บาท', opts:['50','60','70','80'], ans:1, explain:'300-240=60' },
  { id:'M09', school:'สาธิตประสานมิตร', year:'2566', subject:'คณิตศาสตร์', level:'ปานกลาง',
    text:'60% ของ 350 เท่ากับเท่าใด', opts:['180','200','210','220'], ans:2, explain:'350×0.6=210' },
  { id:'M10', school:'สวนกุหลาบ',   year:'2566', subject:'คณิตศาสตร์', level:'ยาก',
    text:'จำนวนใดต่อไปนี้เป็นจำนวนเฉพาะ', opts:['51','57','59','63'], ans:2, explain:'59 หารได้แค่ 1 กับ 59' },

  // ── วิทยาศาสตร์ ─────────────────────────────────────────
  { id:'S01', school:'สาธิตประสานมิตร', year:'2566', subject:'วิทยาศาสตร์', level:'ง่าย',
    text:'อวัยวะใดทำหน้าที่สูบฉีดโลหิต', opts:['ปอด','ตับ','หัวใจ','ไต'], ans:2, explain:'หัวใจสูบฉีดโลหิตไปทั่วร่างกาย' },
  { id:'S02', school:'สาธิตประสานมิตร', year:'2566', subject:'วิทยาศาสตร์', level:'ปานกลาง',
    text:'น้ำเดือดที่ระดับน้ำทะเลมีอุณหภูมิกี่องศาเซลเซียส', opts:['90°C','95°C','100°C','105°C'], ans:2, explain:'100°C ที่ 1 atm' },
  { id:'S03', school:'สวนกุหลาบ',   year:'2566', subject:'วิทยาศาสตร์', level:'ปานกลาง',
    text:'พืชสร้างอาหารจากกระบวนการใด', opts:['การหายใจ','การสังเคราะห์ด้วยแสง','การย่อยอาหาร','การขับถ่าย'], ans:1, explain:'Photosynthesis: แสง+CO₂+H₂O → อาหาร+O₂' },
  { id:'S04', school:'สาธิตประสานมิตร', year:'2566', subject:'วิทยาศาสตร์', level:'ยาก',
    text:'ข้อใดเป็นการเปลี่ยนแปลงทางเคมี', opts:['น้ำแข็งละลาย','กระดาษถูกตัด','เหล็กเป็นสนิม','แก้วแตก'], ans:2, explain:'เหล็กเป็นสนิม: Fe+O₂→Fe₂O₃ เกิดสารใหม่' },
  { id:'S05', school:'สามเสน',       year:'2566', subject:'วิทยาศาสตร์', level:'ยาก',
    text:'ดาวเคราะห์ดวงใดอยู่ใกล้ดวงอาทิตย์มากที่สุด', opts:['โลก','ดาวศุกร์','ดาวพุธ','ดาวอังคาร'], ans:2, explain:'ดาวพุธใกล้ดวงอาทิตย์มากที่สุด' },
  { id:'S06', school:'สาธิตจุฬา',    year:'2566', subject:'วิทยาศาสตร์', level:'ยากมาก',
    text:'ถ้าพืชไม่ได้รับแสงนาน 3 สัปดาห์จะเกิดอะไรขึ้น', opts:['ใบเขียวขึ้น','ลำต้นแข็งแรงขึ้น','ไม่สามารถสังเคราะห์อาหารได้','รากยาวขึ้น'], ans:2, explain:'ขาดแสง → ไม่เกิด Photosynthesis' },
  { id:'S07', school:'บดินทรเดชา',  year:'2566', subject:'วิทยาศาสตร์', level:'ปานกลาง',
    text:'แสงเดินทางในลักษณะใด', opts:['เส้นโค้ง','เส้นตรง','เส้นหยัก','วงกลม'], ans:1, explain:'แสงเดินทางเป็นเส้นตรงในตัวกลางเนื้อเดียวกัน' },
  { id:'S08', school:'หอวัง',        year:'2566', subject:'วิทยาศาสตร์', level:'ง่าย',
    text:'แรงใดทำให้วัตถุตกลงสู่พื้นโลก', opts:['แรงแม่เหล็ก','แรงโน้มถ่วง','แรงเสียดทาน','แรงดัน'], ans:1, explain:'แรงโน้มถ่วง (Gravity)' },
  { id:'S09', school:'สวนกุหลาบ',   year:'2566', subject:'วิทยาศาสตร์', level:'ปานกลาง',
    text:'ก๊าซใดที่พืชปล่อยออกมาระหว่างสังเคราะห์แสง', opts:['CO₂','N₂','O₂','H₂'], ans:2, explain:'พืชปล่อย O₂ เป็นผลพลอยได้จาก Photosynthesis' },
  { id:'S10', school:'สามเสน',       year:'2566', subject:'วิทยาศาสตร์', level:'ยาก',
    text:'โครงสร้างใดในเซลล์พืชที่ไม่พบในเซลล์สัตว์', opts:['นิวเคลียส','ไมโทคอนเดรีย','คลอโรพลาสต์','เยื่อหุ้มเซลล์'], ans:2, explain:'คลอโรพลาสต์พบเฉพาะในเซลล์พืชสำหรับสังเคราะห์แสง' },

  // ── ภาษาไทย ─────────────────────────────────────────────
  { id:'T01', school:'สาธิตจุฬา',    year:'2566', subject:'ภาษาไทย', level:'ง่าย',
    text:'"ใจดี" เป็นคำประเภทใด', opts:['คำนาม','คำกริยา','คำวิเศษณ์','คำสันธาน'], ans:2, explain:'ใจดี ขยายคุณสมบัติ = คำวิเศษณ์' },
  { id:'T02', school:'สาธิตจุฬา',    year:'2566', subject:'ภาษาไทย', level:'ปานกลาง',
    text:'"น้ำขึ้นให้รีบตัก" หมายความว่าอย่างไร', opts:['ตักน้ำตอนน้ำขึ้น','ใช้โอกาสที่ดีทันที','รีบทำทุกอย่าง','อย่าเสียเวลา'], ans:1, explain:'ฉวยโอกาสดีเมื่อมีโอกาส' },
  { id:'T03', school:'สวนกุหลาบ',    year:'2566', subject:'ภาษาไทย', level:'ยาก',
    text:'ข้อใดเป็นประโยคกรรม', opts:['แมวจับหนู','หนูถูกแมวจับ','เด็กวิ่งเล่น','แม่ทำอาหาร'], ans:1, explain:'หนูถูกแมวจับ = Passive voice' },
  { id:'T04', school:'สามเสน',        year:'2566', subject:'ภาษาไทย', level:'ปานกลาง',
    text:'คำว่า "กินข้าว" คำไหนเป็นคำกริยา', opts:['กิน','ข้าว','กินข้าว','ทั้งสองคำ'], ans:0, explain:'กิน = กริยา, ข้าว = นาม' },
  { id:'T05', school:'สาธิตจุฬา',    year:'2566', subject:'ภาษาไทย', level:'ยากมาก',
    text:'ข้อใดใช้ราชาศัพท์ถูกต้อง', opts:['พระมหากษัตริย์กิน','พระมหากษัตริย์เสวย','พระมหากษัตริย์รับประทาน','ทาน'], ans:1, explain:'เสวย = ราชาศัพท์ของ "กิน"' },
  { id:'T06', school:'สาธิตประสานมิตร', year:'2566', subject:'ภาษาไทย', level:'ยาก',
    text:'พระอภัยมณีเป็นวรรณคดีของกวีท่านใด', opts:['สุนทรภู่','เจ้าพระยาพระคลัง','รัชกาลที่ 2','รัชกาลที่ 6'], ans:0, explain:'สุนทรภู่ประพันธ์ในสมัย ร.2' },
  { id:'T07', school:'บดินทรเดชา',  year:'2566', subject:'ภาษาไทย', level:'ง่าย',
    text:'สระในภาษาไทยมีกี่รูป', opts:['21','32','44','18'], ans:0, explain:'สระไทย 21 รูป' },
  { id:'T08', school:'หอวัง',        year:'2566', subject:'ภาษาไทย', level:'ปานกลาง',
    text:'"แมวในถุง" หมายความว่า', opts:['แมวที่ซ่อนอยู่','สิ่งที่ยังไม่รู้ค่า','ของหายาก','ของลึกลับ'], ans:1, explain:'สำนวน: สิ่งที่ยังไม่รู้ค่าที่แท้จริง' },
  { id:'T09', school:'สวนกุหลาบ',   year:'2566', subject:'ภาษาไทย', level:'ปานกลาง',
    text:'ข้อใดเป็นคำประสม', opts:['กิน','กินข้าว','แม่น้ำ','วิ่ง'], ans:2, explain:'แม่น้ำ = คำประสม มีความหมายใหม่' },
  { id:'T10', school:'สาธิตจุฬา',   year:'2566', subject:'ภาษาไทย', level:'ยาก',
    text:'ประโยคใดใช้คำเชื่อมถูกต้อง', opts:['เขาป่วย เพราะฉะนั้นมาโรงเรียน','เขาป่วย ดังนั้นจึงไม่มาโรงเรียน','เขาป่วย แต่ไม่มาโรงเรียน','เขาป่วย หรือไม่มาโรงเรียน'], ans:1, explain:'"ดังนั้นจึง" ใช้เชื่อมเหตุ-ผลได้ถูกต้อง' },

  // ── English ─────────────────────────────────────────────
  { id:'E01', school:'สาธิตจุฬา',    year:'2566', subject:'English', level:'ง่าย',
    text:'Which word is the correct plural of "child"?', opts:['childs','childes','children','childrens'], ans:2, explain:'"children" is the irregular plural' },
  { id:'E02', school:'สวนกุหลาบ',   year:'2566', subject:'English', level:'ง่าย',
    text:'Choose the correct sentence:', opts:['She go to school.','She goes to school.','She going to school.','She gone to school.'], ans:1, explain:'Subject "she" → V+s in simple present' },
  { id:'E03', school:'สามเสน',       year:'2566', subject:'English', level:'ปานกลาง',
    text:'Fill in: "I _____ breakfast when she called."', opts:['eat','am eating','was eating','have eaten'], ans:2, explain:'Past Continuous: was/were + V-ing — action interrupted' },
  { id:'E04', school:'สาธิตจุฬา',    year:'2566', subject:'English', level:'ปานกลาง',
    text:'Which is the correct question form?', opts:['Where you live?','Where do you live?','Where does you live?','Where are you live?'], ans:1, explain:'Wh-questions use "do/does" with base verb' },
  { id:'E05', school:'สาธิตประสานมิตร', year:'2566', subject:'English', level:'ยาก',
    text:'"The report must be submitted by Friday." — What form is this?', opts:['Active','Passive','Direct speech','Indirect speech'], ans:1, explain:'be + past participle = passive voice' },
  { id:'E06', school:'สวนกุหลาบ',   year:'2566', subject:'English', level:'ปานกลาง',
    text:'Choose the antonym of "brave":', opts:['bold','fearless','cowardly','confident'], ans:2, explain:'"cowardly" is the opposite of "brave"' },
  { id:'E07', school:'บดินทรเดชา',  year:'2566', subject:'English', level:'ยาก',
    text:'Which sentence uses the correct article?', opts:['I saw a elephant.','I saw an elephant.','I saw the elephant a.','I saw elephant.'], ans:1, explain:'"an" before vowel sounds: an elephant' },
  { id:'E08', school:'หอวัง',        year:'2566', subject:'English', level:'ง่าย',
    text:'What does "enormous" mean?', opts:['tiny','very big','average','beautiful'], ans:1, explain:'"enormous" means extremely large' },
  { id:'E09', school:'สาธิตจุฬา',   year:'2566', subject:'English', level:'ยากมาก',
    text:'Choose the sentence with correct subject-verb agreement:', opts:['The team are playing well.','The team is playing well.','The team were playing well.','The team be playing well.'], ans:1, explain:'"team" is a collective noun → singular verb "is"' },
  { id:'E10', school:'สามเสน',       year:'2566', subject:'English', level:'ปานกลาง',
    text:'Fill in: "She has been studying English _____ 3 years."', opts:['since','for','during','while'], ans:1, explain:'"for" + duration period (3 years)' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const school  = searchParams.get('school')  || ''
  const subject = searchParams.get('subject') || ''
  const year    = searchParams.get('year')    || ''

  let questions: any[] = []

  // Try Supabase first (service role — ไม่ติด RLS)
  try {
    const sb = getServiceClient()
    let query = sb.from('questions').select('*')
    if (school)  query = query.eq('school', school)
    if (subject) query = query.eq('subject', subject)
    if (year)    query = query.eq('year', year)

    const { data } = await query
    if (data && data.length >= 3) {
      questions = data.map((r: any) => ({
        id: r.id, school: r.school, year: r.year, subject: r.subject,
        level: r.level, text: r.text,
        opts: [r.opt_a, r.opt_b, r.opt_c, r.opt_d],
        ans: r.ans, explain: r.explain || '',
        image_url:   r.image_url   || '',
        opt_a_img:   r.opt_a_img   || '',
        opt_b_img:   r.opt_b_img   || '',
        opt_c_img:   r.opt_c_img   || '',
        opt_d_img:   r.opt_d_img   || '',
        explain_img: r.explain_img || '',
      }))
    }
  } catch (_) {}

  // Fallback to static (พร้อมกรองตาม school/subject/year)
  if (!questions.length) {
    questions = STATIC_QUESTIONS.filter(q => {
      if (school  && q.school  !== school)  return false
      if (subject && q.subject !== subject) return false
      if (year    && q.year    !== year)    return false
      return true
    })
  }

  // ถ้าไม่มีข้อสอบตรง school/year ให้ fallback ตาม subject เฉยๆ
  if (!questions.length && subject) {
    questions = STATIC_QUESTIONS.filter(q => q.subject === subject)
  }

  // Shuffle + limit 10
  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, 10)
  return NextResponse.json({ ok: true, questions: shuffled, source: 'static', total: shuffled.length })
}

// POST /api/questions — admin เพิ่มข้อสอบ (ใช้ service role)
export async function POST(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ตรวจ PIN
  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'PIN ไม่ถูกต้อง' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { school, year, subject, level, text, opt_a, opt_b, opt_c, opt_d, ans, explain, source, image_url, opt_a_img, opt_b_img, opt_c_img, opt_d_img, explain_img } = body

  if (!school || !subject || !text || !opt_a || !opt_b) {
    return NextResponse.json({ ok: false, error: 'กรุณากรอกข้อมูลให้ครบ (โรงเรียน วิชา โจทย์ ตัวเลือก ก ข)' }, { status: 400 })
  }

  const { data, error } = await sb.from('questions').insert({
    school, year: year || '2566', subject, level: level || 'ปานกลาง',
    text, opt_a, opt_b, opt_c: opt_c || '', opt_d: opt_d || '',
    ans: typeof ans === 'number' ? ans : 0,
    explain:     explain     || '',
    source:      source      || 'admin',
    image_url:   image_url   || '',
    opt_a_img:   opt_a_img   || '',
    opt_b_img:   opt_b_img   || '',
    opt_c_img:   opt_c_img   || '',
    opt_d_img:   opt_d_img   || '',
    explain_img: explain_img || '',
  }).select('id').single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id, message: 'เพิ่มข้อสอบสำเร็จ' })
}

// DELETE /api/questions?id=xxx
export async function DELETE(req: NextRequest) {
  const adminPin = req.headers.get('x-admin-pin') || ''
  if (!adminPin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const sb = getServiceClient()
  const { data: cfg } = await sb.from('settings').select('parent_pin').eq('id', 1).single()
  if (!cfg || adminPin !== cfg.parent_pin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })

  const { error } = await sb.from('questions').delete().eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
