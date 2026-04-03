'use client'
// ════════════════════════════════════════════════════════
//  TiwChalet Admin Page  v2.0
//  Oady เข้าได้คนเดียว — จัดการทุกอย่าง
// ════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'

interface Settings {
  parent_pin:string; full_version_pin:string; full_version_days:number
  full_version_price:string; full_version_enabled:boolean
  qr_code_image_url:string; child_name:string; child_avatar_url:string
  child_target_school:string; admin_phone:string; admin_email:string; admin_line_id:string
}
interface UpgradeReq {
  id:string; name:string; contact:string; note:string
  status:string; created_at:string; amount?:string; slip_image?:string; approved_at?:string
}
interface PdfQuestion {
  text:string; opt_a:string; opt_b:string; opt_c:string; opt_d:string
  ans:number; explain:string; subject?:string; level?:string
  opts?:string[]; hasAns?:boolean; _idx?:number
}
type Tab = 'settings'|'approve'|'questions'|'pdf'|'stats'
type ListType = 'schools'|'subjects'|'years'

const DEFAULT_SCHOOLS  = ['สวนกุหลาบ','สามเสน','สาธิตจุฬา','สาธิตประสานมิตร','บดินทรเดชา','หอวัง']
const DEFAULT_SUBJECTS = ['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English']
const DEFAULT_YEARS    = ['2564','2565','2566','2567','2568']

// load custom lists from localStorage
function loadCustomLists() {
  try {
    const d = localStorage.getItem('tc-admin-lists')
    return d ? JSON.parse(d) : {}
  } catch { return {} }
}
function saveCustomLists(d: any) {
  try { localStorage.setItem('tc-admin-lists', JSON.stringify(d)) } catch {}
}
const OPTS     = ['ก','ข','ค','ง']
const C = { green:'#16a34a',greenL:'#dcfce7',greenD:'#14532d',navy:'#1e293b',gold:'#d97706',goldL:'#fef3c7',red:'#dc2626',redL:'#fee2e2',blue:'#1d4ed8',blueL:'#eff6ff',border:'#e2e8f0',muted:'#64748b',text:'#0f172a' }

function Sec({title,icon,children,open:init=true}:{title:string;icon:string;children:React.ReactNode;open?:boolean}) {
  const [o,setO]=useState(init)
  return (
    <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,marginBottom:10,overflow:'hidden'}}>
      <button onClick={()=>setO(p=>!p)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
        <span style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:700,color:C.text}}>{icon} {title}</span>
        <span style={{fontSize:12,color:C.muted}}>{o?'▲':'▼'}</span>
      </button>
      {o&&<div style={{padding:'0 16px 16px',borderTop:`1px solid ${C.border}`}}>{children}</div>}
    </div>
  )
}
const F = ({label,children}:{label:string;children:React.ReactNode}) => (
  <div style={{marginBottom:12}}><label style={{display:'block',fontSize:12,fontWeight:600,color:C.muted,marginBottom:5}}>{label}</label>{children}</div>
)
const IS = {style:{width:'100%',padding:'9px 11px',borderRadius:9,border:`1.5px solid ${C.border}`,background:'#fafafa',fontFamily:'inherit',fontSize:14,color:C.text,outline:'none'} as React.CSSProperties}
const Btn = ({onClick,disabled,color='navy',children}:{onClick:()=>void;disabled?:boolean;color?:'navy'|'green'|'red'|'gold';children:React.ReactNode}) => {
  const bg = {navy:C.navy,green:C.green,red:C.red,gold:C.gold}[color]
  return <button onClick={onClick} disabled={disabled} style={{padding:'9px 16px',borderRadius:9,border:'none',background:disabled?'#94a3b8':bg,color:'#fff',fontSize:13,fontWeight:600,cursor:disabled?'default':'pointer',fontFamily:'inherit'}}>{children}</button>
}

// ── ImgUpload component ──────────────────────────────────
function ImgUpload({label,value,onChange,onFile,highlight=false}:{
  label:string; value:string; onChange:(v:string)=>void
  onFile:(f:File)=>void; highlight?:boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const C2  = { border:'#e2e8f0', muted:'#64748b', green:'#16a34a' }

  const onPaste = (e:React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i=>i.type.startsWith('image/'))
    if(item) { e.preventDefault(); const f=item.getAsFile(); if(f) onFile(f) }
  }

  return (
    <div style={{marginBottom:6}}>
      <div style={{fontSize:11,color:highlight?C2.green:C2.muted,fontWeight:highlight?700:400,marginBottom:3}}>{label}</div>
      {value ? (
        <div style={{position:'relative',display:'inline-block',width:'100%'}}>
          <img src={value} alt={label} style={{width:'100%',maxHeight:100,objectFit:'contain',borderRadius:7,border:`1.5px solid ${highlight?C2.green:C2.border}`,display:'block'}}/>
          <button onClick={()=>onChange('')}
            style={{position:'absolute',top:3,right:3,width:20,height:20,borderRadius:10,border:'none',background:'rgba(0,0,0,.5)',color:'#fff',fontSize:11,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
        </div>
      ) : (
        <div onPaste={onPaste}
          onClick={()=>ref.current?.click()}
          style={{border:`1.5px dashed ${highlight?C2.green:C2.border}`,borderRadius:7,padding:'8px',textAlign:'center',cursor:'pointer',fontSize:10,color:C2.muted,background:highlight?'#f0fdf4':'#fafafa'}}>
          📋 Ctrl+V วาง · หรือ คลิกเลือกไฟล์
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{display:'none'}}
        onChange={e=>{ const f=e.target.files?.[0]; if(f){onFile(f); e.target.value=''} }}/>
    </div>
  )
}

export default function AdminPage() {
  const [pin,    setPin]    = useState('')
  const [authed, setAuthed] = useState(false)
  const [tab,    setTab]    = useState<Tab>('approve')
  const [settings,setSettings]=useState<Settings|null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg,setSaveMsg]=useState('')

  // approve tab
  const [requests,setRequests]=useState<UpgradeReq[]>([])
  const [approving,setApproving]=useState<string|null>(null)
  const [selectedSlip,setSelectedSlip]=useState<string|null>(null)

  // questions tab
  const [questions,setQuestions]=useState<any[]>([])
  const [newQ,setNewQ]=useState({school:'สวนกุหลาบ',year:'2566',subject:'คณิตศาสตร์',level:'ปานกลาง',text:'',optA:'',optB:'',optC:'',optD:'',ans:0,explain:'',imageUrl:'',optAImg:'',optBImg:'',optCImg:'',optDImg:'',explainImg:''})
  const [addingQ,setAddingQ]=useState(false)

  // pdf tab
  const [pdfMeta,setPdfMeta]=useState({school:'สวนกุหลาบ',subject:'คณิตศาสตร์',year:'2566'})
  type PdfStep='idle'|'reading'|'parsing'|'preview'|'importing'|'done'|'error'
  const [pdfStep,setPdfStep]=useState<PdfStep>('idle')
  const [pdfMsg,setPdfMsg]=useState('')
  const [pdfErr,setPdfErr]=useState('')
  const [pdfFileId,setPdfFileId]=useState('')
  // custom lists
  const [customSchools,setCustomSchools]=useState<string[]>([])
  const [customSubjects,setCustomSubjects]=useState<string[]>([])
  const [customYears,setCustomYears]=useState<string[]>([])
  const [showAddList,setShowAddList]=useState<ListType|null>(null)
  const [newListItem,setNewListItem]=useState('')

  const allSchools  = [...DEFAULT_SCHOOLS, ...customSchools]
  const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects]
  const allYears    = [...DEFAULT_YEARS, ...customYears]
  const [pdfQs,setPdfQs]=useState<PdfQuestion[]>([])
  const [editIdx,setEditIdx]=useState<number|null>(null)
  const pdfRef=useRef<HTMLInputElement>(null)

  // stats tab
  const [stats,setStats]=useState<any[]>([])

  // backup
  const [backing,setBacking]=useState(false)
  const [backMsg,setBackMsg]=useState('')

  useEffect(()=>{
    const d = loadCustomLists()
    if(d.schools)  setCustomSchools(d.schools)
    if(d.subjects) setCustomSubjects(d.subjects)
    if(d.years)    setCustomYears(d.years)
  },[])

  const addListItem = (type: ListType) => {
    const v = newListItem.trim()
    if(!v) return
    let updated: string[] = []
    if(type==='schools')  { updated=[...customSchools,v];  setCustomSchools(updated);  saveCustomLists({schools:updated,subjects:customSubjects,years:customYears}) }
    if(type==='subjects') { updated=[...customSubjects,v]; setCustomSubjects(updated); saveCustomLists({schools:customSchools,subjects:updated,years:customYears}) }
    if(type==='years')    { updated=[...customYears,v];    setCustomYears(updated);    saveCustomLists({schools:customSchools,subjects:customSubjects,years:updated}) }
    setNewListItem(''); setShowAddList(null)
  }

  const removeListItem = (type: ListType, item: string) => {
    if(DEFAULT_SCHOOLS.includes(item)||DEFAULT_SUBJECTS.includes(item)||DEFAULT_YEARS.includes(item)){
      alert('ไม่สามารถลบรายการ default ได้'); return
    }
    if(type==='schools')  { const u=customSchools.filter(s=>s!==item);  setCustomSchools(u);  saveCustomLists({schools:u,subjects:customSubjects,years:customYears}) }
    if(type==='subjects') { const u=customSubjects.filter(s=>s!==item); setCustomSubjects(u); saveCustomLists({schools:customSchools,subjects:u,years:customYears}) }
    if(type==='years')    { const u=customYears.filter(s=>s!==item);    setCustomYears(u);    saveCustomLists({schools:customSchools,subjects:customSubjects,years:u}) }
  }

  const loadAll = async (p:string) => {
    // settings (full with PINs)
    const rs = await fetch('/api/settings',{method:'PUT',headers:{'x-admin-pin':p}})
    const ds = await rs.json()
    if(ds.settings) setSettings(ds.settings)
    // upgrade requests
    const rr = await fetch('/api/approve',{headers:{'x-admin-pin':p}})
    const dr = await rr.json()
    if(dr.requests) setRequests(dr.requests)
    // questions
    const rq = await fetch('/api/questions')
    const dq = await rq.json()
    if(dq.questions) setQuestions(dq.questions)
    // stats
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data } = await sb.from('exam_results').select('*').order('created_at',{ascending:false}).limit(20)
      if(data) setStats(data)
    } catch{}
  }

  const login = async () => {
    const res  = await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,type:'parent',clientId:'admin-page'})})
    const data = await res.json()
    if(data.ok){ setAuthed(true); await loadAll(pin) }
    else alert(data.error||'PIN ไม่ถูกต้อง')
  }

  const save = async () => {
    if(!settings) return
    setSaving(true); setSaveMsg('')
    const res  = await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':pin},body:JSON.stringify(settings)})
    const data = await res.json()
    setSaveMsg(data.ok?'✓ บันทึกสำเร็จ':'เกิดข้อผิดพลาด: '+(data.error||''))
    setSaving(false)
    setTimeout(()=>setSaveMsg(''),3000)
  }

  const doApprove = async (id:string, action:'approve'|'reject') => {
    setApproving(id)
    try {
      const res  = await fetch('/api/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,action,adminPin:pin})})
      const data = await res.json()
      if(data.ok) {
        setRequests(p=>p.map(r=>r.id===id?{...r,status:data.status}:r))
        if(action==='approve' && data.fullPin) {
          alert(`✅ อนุมัติแล้ว!\nPIN Full Version ที่ต้องส่งให้ลูกค้า: ${data.fullPin}\n\nแจ้ง LINE แล้วอัตโนมัติ`)
        }
      } else alert(data.error||'เกิดข้อผิดพลาด')
    } catch{ alert('เชื่อมต่อไม่ได้') }
    finally{ setApproving(null) }
  }

  // Helper: อ่านรูปจาก file/paste แล้ว resize เป็น max 800px
  const readAndResizeImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) { reject(new Error('รูปใหญ่เกิน 5MB')); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('อ่านรูปไม่ได้'))
      img.src = ev.target!.result as string
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsDataURL(file)
  })

  const addQuestion = async () => {
    if(!newQ.text||!newQ.optA) return
    setAddingQ(true)
    try {
      // ← ใช้ API route แทน direct supabase เพื่อใช้ service_role key
      const res  = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({
          school:  newQ.school,  year:    newQ.year,
          subject: newQ.subject, level:   newQ.level,
          text:    newQ.text,    opt_a:   newQ.optA,
          opt_b:   newQ.optB,    opt_c:   newQ.optC,
          opt_d:   newQ.optD,    ans:     newQ.ans,
          explain: newQ.explain, source:  'admin',
        }),
      })
      const data = await res.json()
      if(!data.ok) throw new Error(data.error||'เกิดข้อผิดพลาด')
      setNewQ(p=>({...p,text:'',optA:'',optB:'',optC:'',optD:'',explain:'',ans:0,imageUrl:'',optAImg:'',optBImg:'',optCImg:'',optDImg:'',explainImg:''}))
      await loadAll(pin)
      alert('✅ '+data.message)
    } catch(e:any){ alert('Error: '+e.message) }
    finally{ setAddingQ(false) }
  }

  const doBackup = async () => {
    setBacking(true); setBackMsg('')
    try {
      const res  = await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':pin},body:JSON.stringify({})})
      const data = await res.json()
      setBackMsg(data.message||'Backup เสร็จ')
    } catch{ setBackMsg('เชื่อมต่อไม่ได้') }
    finally{ setBacking(false) }
  }

  // ── PDF flow — รองรับทั้งพิมพ์และสแกน (Tesseract OCR) ──
  const extractTextFromPdf = async (
    file: File,
    onProgress: (msg: string) => void
  ): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    onProgress('โหลด PDF reader...')
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages

    // ลองอ่าน text ปกติก่อน
    onProgress(`PDF ${numPages} หน้า — อ่านข้อความ...`)
    let fullText = ''
    for (let p = 1; p <= numPages; p++) {
      const page    = await pdf.getPage(p)
      const content = await page.getTextContent()
      fullText += content.items.map((item: any) => item.str || '').join(' ') + '\n'
    }

    // ถ้ามีข้อความเพียงพอ = PDF พิมพ์ ไม่ต้อง OCR
    if (fullText.replace(/\s/g, '').length >= 80) {
      onProgress('อ่านข้อความสำเร็จ')
      return fullText
    }

    // PDF สแกน — โหลด Tesseract OCR จาก CDN
    onProgress('PDF สแกน — กำลังโหลด OCR engine (ครั้งแรกอาจใช้เวลา ~30 วิ)...')
    await new Promise<void>((resolve, reject) => {
      if ((window as any).Tesseract) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('โหลด OCR engine ไม่ได้ ตรวจสอบ internet แล้วลองใหม่'))
      document.head.appendChild(script)
    })

    const Tesseract = (window as any).Tesseract
    onProgress('OCR engine พร้อม — สร้าง worker...')

    let ocrText = ''
    const worker = await Tesseract.createWorker('tha+eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          onProgress(`OCR กำลังอ่าน... ${Math.round(m.progress * 100)}%`)
        }
      }
    })

    try {
      for (let p = 1; p <= numPages; p++) {
        onProgress(`OCR หน้า ${p}/${numPages}...`)
        const page     = await pdf.getPage(p)
        const scale    = 2.5
        const viewport = page.getViewport({ scale })
        const canvas   = document.createElement('canvas')
        canvas.width   = viewport.width
        canvas.height  = viewport.height
        const ctx      = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as any).promise
        const { data } = await worker.recognize(canvas)
        ocrText += data.text + '\n'
      }
    } finally {
      await worker.terminate()
    }

    onProgress('OCR เสร็จ')
    return ocrText
  }

  const onPdfFile = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return; e.target.value=''
    setPdfStep('reading'); setPdfMsg(`อ่านไฟล์ ${file.name}...`); setPdfErr('')
    try {
      const pdfText = await extractTextFromPdf(file, (msg) => {
        setPdfMsg(msg)
        setPdfStep('parsing')
      })

      setPdfStep('parsing'); setPdfMsg('วิเคราะห์ข้อสอบ...')

      const res = await fetch('/api/import-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ pdfText, fileName: file.name, ...pdfMeta }),
      })

      if(!res.ok) {
        const txt = await res.text()
        throw new Error(`Server error ${res.status}: ${txt.slice(0,200)}`)
      }

      const data = await res.json()
      if(!data.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      if(data.status==='scanned') {
        setPdfStep('error')
        setPdfErr(data.message + '\n\n' + (data.howTo||''))
      } else if(data.status==='text_only') {
        setPdfStep('error')
        setPdfErr(`${data.message}\n\n${data.howTo||''}\n\nข้อความที่ OCR ได้:\n${(data.rawText||'').slice(0,600)}`)
      } else if(data.status==='preview') {
        setPdfFileId(data.fileId||''); setPdfQs(data.questions||[])
        setPdfStep('preview'); setPdfMsg(data.message || `พบ ${data.total} ข้อ`)
      } else {
        throw new Error('Response ไม่ถูกต้อง')
      }
    } catch(err:any){
      setPdfStep('error')
      setPdfErr(err.message || 'เกิดข้อผิดพลาด')
    }
  }

  const confirmPdf = async () => {
    setPdfStep('importing'); setPdfMsg('บันทึกลง Supabase...')
    try {
      const res  = await fetch('/api/import-pdf',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':pin},body:JSON.stringify({confirmImport:true,previewData:pdfQs,fileId:pdfFileId,...pdfMeta})})
      const data = await res.json()
      if(!data.ok) throw new Error(data.error)
      setPdfStep('done'); setPdfMsg(data.message||`เพิ่ม ${data.imported} ข้อสำเร็จ`)
      await loadAll(pin)
    } catch(err:any){ setPdfStep('error'); setPdfErr(err.message) }
  }

  const upd=(k:keyof Settings,v:any)=>setSettings(p=>p?{...p,[k]:v}:p)

  // ── login screen ──
  // ── Add list item modal ──
  const AddListModal = showAddList ? (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,padding:'24px 20px',width:'100%',maxWidth:340}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14}}>
          {showAddList==='schools'?'+ เพิ่มโรงเรียน':showAddList==='subjects'?'+ เพิ่มวิชา':'+ เพิ่มปีการศึกษา'}
        </div>
        <input value={newListItem} onChange={e=>setNewListItem(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addListItem(showAddList!)}
          placeholder={showAddList==='schools'?'เช่น เตรียมอุดม':showAddList==='subjects'?'เช่น สังคมศึกษา':'เช่น 2568'}
          autoFocus
          style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:14,fontFamily:'inherit',marginBottom:14,outline:'none'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <button onClick={()=>{setShowAddList(null);setNewListItem('')}} style={{padding:'10px',borderRadius:9,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>ยกเลิก</button>
          <button onClick={()=>addListItem(showAddList!)} disabled={!newListItem.trim()} style={{padding:'10px',borderRadius:9,border:'none',background:newListItem.trim()?C.navy:'#d1d5db',color:'#fff',cursor:newListItem.trim()?'pointer':'default',fontFamily:'inherit',fontSize:13,fontWeight:600}}>เพิ่ม</button>
        </div>
        {/* แสดง current list */}
        <div style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
          <div style={{fontSize:12,color:C.muted,marginBottom:8}}>รายการทั้งหมด:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {(showAddList==='schools'?allSchools:showAddList==='subjects'?allSubjects:allYears).map(item=>(
              <span key={item} onClick={()=>removeListItem(showAddList!,item)}
                style={{fontSize:11,padding:'3px 9px',borderRadius:20,background:DEFAULT_SCHOOLS.includes(item)||DEFAULT_SUBJECTS.includes(item)||DEFAULT_YEARS.includes(item)?'#f1f5f9':C.redL,color:DEFAULT_SCHOOLS.includes(item)||DEFAULT_SUBJECTS.includes(item)||DEFAULT_YEARS.includes(item)?C.muted:C.red,cursor:'pointer',border:`1px solid ${DEFAULT_SCHOOLS.includes(item)||DEFAULT_SUBJECTS.includes(item)||DEFAULT_YEARS.includes(item)?C.border:'#fca5a5'}`}}>
                {item} {!(DEFAULT_SCHOOLS.includes(item)||DEFAULT_SUBJECTS.includes(item)||DEFAULT_YEARS.includes(item))&&'×'}
              </span>
            ))}
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>คลิกที่รายการที่เพิ่มเองเพื่อลบ (default ลบไม่ได้)</div>
        </div>
      </div>
    </div>
  ) : null

  if(!authed) return (
    <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'Sarabun',sans-serif",padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 24px',width:'100%',maxWidth:300,textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,.1)'}}>
        <div style={{fontSize:36,marginBottom:12}}>⚙️</div>
        <div style={{fontSize:20,fontWeight:700,marginBottom:4,color:C.text}}>Admin Panel</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>TiwChalet v2.0 · Oady</div>
        <input value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} type="password" placeholder="PIN ผู้ปกครอง" maxLength={4} style={{...IS.style,textAlign:'center',fontSize:18,letterSpacing:8,marginBottom:12}}/>
        <button onClick={login} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:C.navy,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>เข้าสู่ระบบ</button>
      </div>
    </div>
  )

  const pendingCount = requests.filter(r=>r.status==='pending').length

  return (
    <div style={{minHeight:'100dvh',background:'#f8fafc',fontFamily:"'Sarabun',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`.spin{animation:spin .8s linear infinite;display:inline-block}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* slip modal */}
      {selectedSlip&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setSelectedSlip(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:16,maxWidth:360,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>สลิปชำระเงิน</div>
              <button onClick={()=>setSelectedSlip(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.muted}}>×</button>
            </div>
            <img src={selectedSlip} alt="slip" style={{width:'100%',borderRadius:10,border:`1px solid ${C.border}`}}/>
          </div>
        </div>
      )}

      {AddListModal}
      {/* topbar */}
      <div style={{background:C.navy,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>⚙️</span>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>Admin Panel</div>
            <div style={{fontSize:11,color:'#94a3b8'}}>TiwChalet v2.0</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={doBackup} disabled={backing} style={{fontSize:12,padding:'6px 10px',borderRadius:8,border:'1px solid #475569',background:'transparent',color:'#cbd5e1',cursor:'pointer',fontFamily:'inherit'}}>
            {backing?<span className="spin">⟳</span>:'💾'} Backup
          </button>
          <a href="/" target="_blank" style={{fontSize:12,padding:'6px 12px',borderRadius:8,border:'1px solid #475569',color:'#cbd5e1',textDecoration:'none'}}>← App</a>
          <button onClick={()=>setAuthed(false)} style={{fontSize:12,padding:'6px 12px',borderRadius:8,border:'1px solid #475569',background:'transparent',color:'#cbd5e1',cursor:'pointer',fontFamily:'inherit'}}>ออก</button>
        </div>
      </div>
      {backMsg&&<div style={{background:backMsg.includes('สำเร็จ')||backMsg.includes('Backup')?C.greenL:C.redL,padding:'6px 16px',fontSize:12,color:backMsg.includes('สำเร็จ')||backMsg.includes('Backup')?C.greenD:C.red}}>{backMsg}</div>}

      {/* tabs */}
      <div style={{background:'#fff',borderBottom:`1px solid ${C.border}`,display:'flex',overflowX:'auto'}}>
        {([
          ['approve',`💰 อนุมัติ${pendingCount>0?` (${pendingCount})`:''}`,],
          ['settings','⚙️ ตั้งค่า'],
          ['pdf','📄 นำเข้า PDF'],
          ['questions','📝 ข้อสอบ'],
          ['stats','📊 สถิติ'],
        ] as [Tab,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'12px 14px',border:'none',borderBottom:`3px solid ${tab===id?C.navy:'transparent'}`,background:'transparent',fontSize:13,fontWeight:tab===id?700:400,color:tab===id?C.text:C.muted,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',position:'relative'}}>
            {label}{id==='approve'&&pendingCount>0&&<span style={{position:'absolute',top:8,right:4,width:8,height:8,borderRadius:'50%',background:C.red}}/>}
          </button>
        ))}
      </div>

      <div style={{maxWidth:680,margin:'0 auto',padding:'16px 14px 40px'}}>

        {/* ── APPROVE TAB ── */}
        {tab==='approve'&&(
          <div>
            {requests.length===0&&<div style={{textAlign:'center',padding:'40px',color:C.muted}}>ยังไม่มีคำขอ</div>}
            {requests.map(r=>(
              <div key={r.id} style={{background:'#fff',border:`1px solid ${r.status==='pending'?'#fde68a':r.status==='approved'?'#86efac':'#fca5a5'}`,borderRadius:14,padding:'14px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{r.name}</div>
                      <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,fontWeight:600,background:r.status==='pending'?C.goldL:r.status==='approved'?C.greenL:C.redL,color:r.status==='pending'?'#92400e':r.status==='approved'?C.greenD:C.red}}>
                        {r.status==='pending'?'รอตรวจ':r.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธ'}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>📱 {r.contact||'-'} · 💰 {r.amount||'-'} บาท</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{new Date(r.created_at).toLocaleString('th-TH')} · ID: {r.id.slice(0,8)}...</div>
                    {r.note&&<div style={{fontSize:12,color:C.text,marginTop:4}}>📝 {r.note}</div>}
                  </div>
                  {r.slip_image&&(
                    <div>
                      <img src={r.slip_image.startsWith('data:')?r.slip_image:`data:image/jpeg;base64,${r.slip_image}`} alt="slip" style={{width:60,height:60,objectFit:'cover',borderRadius:8,border:`1px solid ${C.border}`,cursor:'pointer'}} onClick={()=>setSelectedSlip(r.slip_image!.startsWith('data:')?r.slip_image!:`data:image/jpeg;base64,${r.slip_image}`)}/>
                      <div style={{fontSize:10,color:C.blue,textAlign:'center',marginTop:2,cursor:'pointer'}} onClick={()=>setSelectedSlip(r.slip_image!.startsWith('data:')?r.slip_image!:`data:image/jpeg;base64,${r.slip_image}`)}>ขยาย</div>
                    </div>
                  )}
                </div>
                {r.status==='pending'&&(
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>doApprove(r.id,'approve')} disabled={approving===r.id} style={{flex:1,padding:'9px',borderRadius:9,border:'none',background:approving===r.id?'#94a3b8':C.green,color:'#fff',fontSize:13,fontWeight:600,cursor:approving===r.id?'default':'pointer',fontFamily:'inherit'}}>
                      {approving===r.id?<span className="spin">⟳</span>:'✅'} อนุมัติ
                    </button>
                    <button onClick={()=>doApprove(r.id,'reject')} disabled={approving===r.id} style={{flex:1,padding:'9px',borderRadius:9,border:'none',background:approving===r.id?'#94a3b8':C.red,color:'#fff',fontSize:13,fontWeight:600,cursor:approving===r.id?'default':'pointer',fontFamily:'inherit'}}>
                      ❌ ปฏิเสธ
                    </button>
                  </div>
                )}
                {r.status==='approved'&&<div style={{fontSize:12,color:C.green,textAlign:'center'}}>✅ อนุมัติแล้ว · {r.approved_at?new Date(r.approved_at).toLocaleString('th-TH'):''}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab==='settings'&&settings&&(
          <div>
            <Sec title="ข้อมูลนักเรียน" icon="👶">
              <F label="ชื่อนักเรียน"><input value={settings.child_name} onChange={e=>upd('child_name',e.target.value)} {...IS}/></F>
              <F label="URL รูปโปรไฟล์">
                <input value={settings.child_avatar_url} onChange={e=>upd('child_avatar_url',e.target.value)} placeholder="https://..." {...IS}/>
                {settings.child_avatar_url&&<img src={settings.child_avatar_url} alt="" style={{width:52,height:52,borderRadius:10,marginTop:6,objectFit:'cover'}}/>}
              </F>
              <F label="โรงเรียนเป้าหมาย">
                <select value={settings.child_target_school} onChange={e=>upd('child_target_school',e.target.value)} {...IS}>
                  {allSchools.map(s=><option key={s}>{s}</option>)}
                </select>
              </F>
            </Sec>

            <Sec title="รหัส PIN" icon="🔒">
              <div style={{background:C.goldL,border:`1px solid #fde68a`,borderRadius:9,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#92400e'}}>
                ⚠️ เปลี่ยน PIN แล้วต้อง logout และ login ใหม่
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <F label="PIN ผู้ปกครอง">
                  <input value={settings.parent_pin} onChange={e=>upd('parent_pin',e.target.value)} maxLength={4} type="password" {...IS}/>
                </F>
                <F label="PIN Full Version (6 หลักตัวเลข)">
                  <input value={settings.full_version_pin} onChange={e=>upd('full_version_pin',e.target.value.replace(/[^0-9]/g,'').slice(0,6))} maxLength={6} type="password" placeholder="••••••" inputMode="numeric" {...IS}/>
                  <div style={{fontSize:11,color:'#64748b',marginTop:4}}>ตัวเลข 6 หลัก · ส่งให้ลูกค้าหลัง approve</div>
                </F>
              </div>
              <div style={{background:C.greenL,borderRadius:9,padding:'9px 12px',fontSize:12,color:C.greenD}}>
                PIN Full Version: <strong style={{fontSize:20,fontFamily:'monospace',letterSpacing:6,color:'#14532d'}}>{settings.full_version_pin}</strong><br/>
                <span style={{fontSize:11,opacity:.8}}>ตัวเลข 6 หลัก · ส่งให้ลูกค้าหลัง approve สลิป</span>
              </div>
            </Sec>

            <Sec title="Full Version" icon="⭐">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <F label="ราคา (บาท)"><input value={settings.full_version_price} onChange={e=>upd('full_version_price',e.target.value)} {...IS}/></F>
                <F label="จำนวนวัน"><input type="number" value={settings.full_version_days} onChange={e=>upd('full_version_days',Number(e.target.value))} min={1} max={365} {...IS}/></F>
              </div>
            </Sec>

            <Sec title="QR Code ธนาคาร" icon="💳">
              <F label="URL รูป QR Code">
                <input value={settings.qr_code_image_url} onChange={e=>upd('qr_code_image_url',e.target.value)} placeholder="https://..." {...IS}/>
                {settings.qr_code_image_url&&<img src={settings.qr_code_image_url} alt="QR" style={{width:130,height:130,borderRadius:10,marginTop:8,objectFit:'contain',border:`1px solid ${C.border}`}}/>}
              </F>
            </Sec>

            <Sec title="ติดต่อ Admin" icon="📞">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <F label="เบอร์โทร"><input value={settings.admin_phone} onChange={e=>upd('admin_phone',e.target.value)} {...IS}/></F>
                <F label="LINE ID"><input value={settings.admin_line_id} onChange={e=>upd('admin_line_id',e.target.value)} {...IS}/></F>
              </div>
              <F label="Email"><input value={settings.admin_email} onChange={e=>upd('admin_email',e.target.value)} {...IS}/></F>
            </Sec>

            <div style={{position:'sticky',bottom:12}}>
              <button onClick={save} disabled={saving} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:saving?'#94a3b8':C.green,color:'#fff',fontSize:15,fontWeight:700,cursor:saving?'default':'pointer',fontFamily:'inherit',boxShadow:'0 4px 12px rgba(22,163,74,.3)'}}>
                {saving?'กำลังบันทึก...':'💾 บันทึกการตั้งค่า'}
              </button>
              {saveMsg&&<div style={{textAlign:'center',fontSize:13,color:saveMsg.includes('สำเร็จ')?C.green:C.red,marginTop:8,fontWeight:600}}>{saveMsg}</div>}
            </div>
          </div>
        )}

        {/* ── PDF TAB ── */}
        {tab==='pdf'&&(
          <div>
            <input ref={pdfRef} type="file" accept=".pdf" style={{display:'none'}} onChange={onPdfFile}/>

            <Sec title="ข้อมูลไฟล์" icon="📋">
              <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
                <button onClick={()=>setShowAddList('schools')} style={{fontSize:11,padding:'3px 8px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>+ โรงเรียน</button>
                <button onClick={()=>setShowAddList('subjects')} style={{fontSize:11,padding:'3px 8px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>+ วิชา</button>
                <button onClick={()=>setShowAddList('years')} style={{fontSize:11,padding:'3px 8px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>+ ปี</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                <F label="โรงเรียน"><select value={pdfMeta.school} onChange={e=>setPdfMeta(p=>({...p,school:e.target.value}))} {...IS}>{allSchools.map(s=><option key={s}>{s}</option>)}</select></F>
                <F label="วิชา"><select value={pdfMeta.subject} onChange={e=>setPdfMeta(p=>({...p,subject:e.target.value}))} {...IS}>{allSubjects.map(s=><option key={s}>{s}</option>)}</select></F>
                <F label="ปี"><select value={pdfMeta.year} onChange={e=>setPdfMeta(p=>({...p,year:e.target.value}))} {...IS}>{allYears.map(y=><option key={y}>{y}</option>)}</select></F>
              </div>
            </Sec>

            {pdfStep==='idle'&&(
              <div onClick={()=>pdfRef.current?.click()} style={{border:'2px dashed #cbd5e1',borderRadius:14,padding:'32px',textAlign:'center',cursor:'pointer',background:'#fafafa'}}>
                <div style={{fontSize:40,marginBottom:10}}>📄</div>
                <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>คลิกเพื่อเลือกไฟล์ PDF</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:8}}>รองรับ PDF พิมพ์ · parse อัตโนมัติ</div>
                <div style={{fontSize:11,color:'#94a3b8'}}>รองรับทั้ง PDF พิมพ์ และ PDF สแกน (OCR อัตโนมัติ)</div>
              </div>
            )}

            {(pdfStep==='reading'||pdfStep==='parsing'||pdfStep==='importing')&&(
              <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'24px 20px',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:12}} className="spin">⟳</div>
                <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6}}>{pdfMsg}</div>
                {pdfStep==='parsing'&&pdfMsg.includes('OCR')&&(
                  <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:9,padding:'8px 12px',fontSize:12,color:'#14532d',marginTop:8}}>
                    🔬 กำลังใช้ OCR อ่านข้อความจากภาพ — อาจใช้เวลา 1-3 นาที/หน้า<br/>
                    <span style={{opacity:.7}}>ขึ้นอยู่กับความละเอียดและจำนวนหน้า</span>
                  </div>
                )}
              </div>
            )}

            {pdfStep==='error'&&(
              <div style={{background:C.redL,border:'1px solid #fca5a5',borderRadius:14,padding:'20px',textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:8}}>❌</div>
                <div style={{fontSize:13,color:'#991b1b',marginBottom:10,whiteSpace:'pre-wrap',lineHeight:1.6}}>{pdfErr}</div>
                {pdfErr.includes('ANTHROPIC_API_KEY')&&(
                  <div style={{background:C.goldL,borderRadius:9,padding:'10px',fontSize:12,color:'#78350f',textAlign:'left',marginBottom:10}}>
                    💡 Vercel → Settings → Environment Variables<br/>
                    เพิ่ม <code style={{background:'#fff',padding:'1px 5px',borderRadius:4}}>ANTHROPIC_API_KEY</code>
                  </div>
                )}
                <button onClick={()=>setPdfStep('idle')} style={{padding:'9px 20px',borderRadius:9,border:'none',background:C.navy,color:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>ลองใหม่</button>
              </div>
            )}

            {pdfStep==='done'&&(
              <div style={{background:C.greenL,border:'1px solid #86efac',borderRadius:14,padding:'24px',textAlign:'center'}}>
                <div style={{fontSize:40,marginBottom:8}}>🎉</div>
                <div style={{fontSize:15,fontWeight:700,color:C.greenD,marginBottom:4}}>{pdfMsg}</div>
                <button onClick={()=>{setPdfStep('idle');setPdfQs([])}} style={{padding:'9px 20px',borderRadius:9,border:'none',background:C.green,color:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13,marginTop:8}}>นำเข้าไฟล์ต่อไป</button>
              </div>
            )}

            {pdfStep==='preview'&&pdfQs.length>0&&(
              <div>
                {/* Summary banner */}
                <div style={{background:C.blueL,border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:'#1e40af',marginBottom:4}}>พบ {pdfQs.length} ข้อ</div>
                      {/* แสดง grouping ตามวิชา */}
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {Object.entries(pdfQs.reduce((acc:Record<string,number>,q:any)=>{acc[q.subject||'ไม่ระบุ']=(acc[q.subject||'ไม่ระบุ']||0)+1;return acc},{})).map(([subj,cnt])=>(
                          <span key={subj} style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#fff',border:'1px solid #bfdbfe',color:'#1e40af',fontWeight:600}}>{subj} {cnt as number} ข้อ</span>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setPdfStep('idle');setPdfQs([])}} style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>ยกเลิก</button>
                      <button onClick={confirmPdf} style={{padding:'7px 14px',borderRadius:8,border:'none',background:C.navy,color:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600}}>✓ ยืนยัน {pdfQs.length} ข้อ</button>
                    </div>
                  </div>
                </div>

                {/* แสดงข้อสอบแยกตามวิชา */}
                {Object.entries(pdfQs.reduce((acc:Record<string,any[]>,q:any,i:number)=>{
                  const subj=q.subject||'ไม่ระบุ'; if(!acc[subj]) acc[subj]=[]; acc[subj].push({...q,_idx:i}); return acc
                },{})).map(([subj,qs])=>(
                  <div key={subj} style={{marginBottom:14}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{padding:'3px 10px',borderRadius:20,background:C.navy,color:'#fff',fontSize:12}}>{subj}</span>
                      <span style={{color:C.muted,fontSize:12}}>{(qs as any[]).length} ข้อ</span>
                      {/* ปุ่มเปลี่ยนวิชาทั้ง group */}
                      <select
                        value={subj}
                        onChange={e=>{const ns=e.target.value; setPdfQs(p=>p.map(q=>q.subject===subj?{...q,subject:ns}:q))}}
                        style={{fontSize:11,padding:'2px 6px',borderRadius:6,border:`1px solid ${C.border}`,background:'#fff',fontFamily:'inherit',color:C.muted,marginLeft:'auto'}}>
                        {['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English','สังคมศึกษา','ไม่ระบุ'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {(qs as any[]).map((q:any)=>{
                      const i=q._idx
                      return (
                        <div key={i} style={{background:'#fff',border:`1px solid ${editIdx===i?C.navy:C.border}`,borderRadius:12,marginBottom:6,overflow:'hidden'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',cursor:'pointer'}} onClick={()=>setEditIdx(editIdx===i?null:i)}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',gap:5,marginBottom:3,flexWrap:'wrap'}}>
                                <span style={{fontSize:10,fontWeight:700,background:'#f1f5f9',color:C.muted,padding:'1px 6px',borderRadius:4}}>ข้อ {i+1}</span>
                                {q.hasAns!==false&&q.ans>=0
                                  ?<span style={{fontSize:10,background:C.greenL,color:C.greenD,padding:'1px 6px',borderRadius:4}}>เฉลย {OPTS[q.ans]}</span>
                                  :<span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 6px',borderRadius:4}}>ไม่มีเฉลย</span>
                                }
                              </div>
                              <div style={{fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.text||'(ไม่มีโจทย์)'}</div>
                            </div>
                            <div style={{display:'flex',gap:5,flexShrink:0,marginLeft:8}}>
                              <button onClick={ev=>{ev.stopPropagation();setEditIdx(editIdx===i?null:i)}} style={{fontSize:10,padding:'3px 7px',borderRadius:5,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,cursor:'pointer',fontFamily:'inherit'}}>แก้ไข</button>
                              <button onClick={ev=>{ev.stopPropagation();setPdfQs(p=>p.filter((_,j)=>j!==i))}} style={{fontSize:10,padding:'3px 7px',borderRadius:5,border:'1px solid #fca5a5',background:C.redL,color:C.red,cursor:'pointer',fontFamily:'inherit'}}>ลบ</button>
                            </div>
                          </div>
                          {editIdx===i&&(
                            <div style={{padding:'10px 12px',borderTop:`1px solid ${C.border}`}}>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                                <F label="วิชา">
                                  <select value={q.subject||'ไม่ระบุ'} onChange={e=>setPdfQs(p=>p.map((x,j)=>j===i?{...x,subject:e.target.value}:x))} {...IS}>
                                    {['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English','สังคมศึกษา','ไม่ระบุ'].map(s=><option key={s}>{s}</option>)}
                                  </select>
                                </F>
                                <F label="ระดับ">
                                  <select value={q.level||'ปานกลาง'} onChange={e=>setPdfQs(p=>p.map((x,j)=>j===i?{...x,level:e.target.value}:x))} {...IS}>
                                    {['ง่าย','ปานกลาง','ยาก','ยากมาก'].map(l=><option key={l}>{l}</option>)}
                                  </select>
                                </F>
                              </div>
                              <F label="โจทย์"><textarea value={q.text} onChange={e=>setPdfQs(p=>p.map((x,j)=>j===i?{...x,text:e.target.value}:x))} rows={2} {...IS as any}/></F>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                                {(['opt_a','opt_b','opt_c','opt_d'] as const).map((k,oi)=>(
                                  <F key={k} label={`${OPTS[oi]}${q.ans===oi?' ✓':''}`}>
                                    <input value={q[k]||''} onChange={e=>setPdfQs(p=>p.map((x,j)=>j===i?{...x,[k]:e.target.value}:x))} onFocus={()=>setPdfQs(p=>p.map((x,j)=>j===i?{...x,ans:oi}:x))} style={{...IS.style,borderColor:q.ans===oi?C.green:undefined,background:q.ans===oi?C.greenL:undefined}}/>
                                  </F>
                                ))}
                              </div>
                              <F label="คำอธิบายเฉลย"><input value={q.explain||''} onChange={e=>setPdfQs(p=>p.map((x,j)=>j===i?{...x,explain:e.target.value}:x))} {...IS}/></F>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}

                <div style={{position:'sticky',bottom:12,paddingTop:4}}>
                  <button onClick={confirmPdf} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 14px rgba(0,0,0,.15)'}}>
                    ✓ ยืนยันนำเข้า {pdfQs.length} ข้อ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QUESTIONS TAB ── */}
        {tab==='questions'&&(
          <div>
            <Sec title="เพิ่มข้อสอบ" icon="➕">
              <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
                <button onClick={()=>setShowAddList('schools')} style={{fontSize:11,padding:'4px 9px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>+ โรงเรียน</button>
                <button onClick={()=>setShowAddList('subjects')} style={{fontSize:11,padding:'4px 9px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>+ วิชา</button>
                <button onClick={()=>setShowAddList('years')} style={{fontSize:11,padding:'4px 9px',borderRadius:7,border:`1px dashed ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit'}}>+ ปี</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <F label="โรงเรียน"><select value={newQ.school} onChange={e=>setNewQ(p=>({...p,school:e.target.value}))} {...IS}>{allSchools.map(s=><option key={s}>{s}</option>)}</select></F>
                <F label="ปี"><select value={newQ.year} onChange={e=>setNewQ(p=>({...p,year:e.target.value}))} {...IS}>{allYears.map(y=><option key={y}>{y}</option>)}</select></F>
                <F label="วิชา"><select value={newQ.subject} onChange={e=>setNewQ(p=>({...p,subject:e.target.value}))} {...IS}>{allSubjects.map(s=><option key={s}>{s}</option>)}</select></F>
                <F label="ระดับ"><select value={newQ.level} onChange={e=>setNewQ(p=>({...p,level:e.target.value}))} {...IS}>{['ง่าย','ปานกลาง','ยาก','ยากมาก'].map(l=><option key={l}>{l}</option>)}</select></F>
              </div>
              <F label="โจทย์ *"><textarea value={newQ.text} onChange={e=>setNewQ(p=>({...p,text:e.target.value}))} rows={2} placeholder="พิมพ์โจทย์..." {...IS as any}/></F>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {(['optA','optB','optC','optD'] as const).map((k,i)=>(
                  <F key={k} label={`ตัวเลือก ${OPTS[i]}${newQ.ans===i?' ✓':''}`}>
                    <input value={newQ[k]} onChange={e=>setNewQ(p=>({...p,[k]:e.target.value}))} onFocus={()=>setNewQ(p=>({...p,ans:i}))} placeholder={`ตัวเลือก ${OPTS[i]}`} style={{...IS.style,borderColor:newQ.ans===i?C.green:undefined,background:newQ.ans===i?C.greenL:undefined}}/>
                  </F>
                ))}
              </div>
              <F label="คำอธิบายเฉลย"><input value={newQ.explain} onChange={e=>setNewQ(p=>({...p,explain:e.target.value}))} {...IS}/></F>
              <div style={{fontSize:11,color:C.muted,marginBottom:8}}>คลิกที่ช่องตัวเลือกเพื่อเซ็ตเป็นเฉลย</div>
              <button onClick={addQuestion} disabled={addingQ||!newQ.text} style={{width:'100%',padding:'11px',borderRadius:10,border:'none',background:addingQ||!newQ.text?'#94a3b8':C.navy,color:'#fff',fontSize:14,fontWeight:700,cursor:addingQ||!newQ.text?'default':'pointer',fontFamily:'inherit'}}>
                {addingQ?<><span className="spin">⟳</span> กำลังเพิ่ม</>:'➕ เพิ่มข้อสอบ'}
              </button>
            </Sec>

            <Sec title={`ข้อสอบทั้งหมด (${questions.length} ข้อ)`} icon="📋">
              {questions.slice(0,15).map((q,i)=>(
                <div key={i} style={{padding:'9px 10px',borderRadius:9,border:`1px solid ${C.border}`,marginBottom:6,background:'#fafafa'}}>
                  <div style={{display:'flex',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:5,background:C.blueL,color:C.blue,fontWeight:500}}>{q.subject}</span>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:5,background:'#f1f5f9',color:C.muted}}>{q.school} · {q.year}</span>
                    {q.source?.startsWith('pdf')&&<span style={{fontSize:11,padding:'2px 7px',borderRadius:5,background:C.goldL,color:'#92400e'}}>PDF</span>}
                  </div>
                  <div style={{fontSize:13,color:C.text}}>{q.text?.slice(0,90)}{(q.text?.length||0)>90?'...':''}</div>
                </div>
              ))}
              {questions.length>15&&<div style={{textAlign:'center',fontSize:12,color:C.muted,padding:'8px'}}>...และอีก {questions.length-15} ข้อใน Supabase</div>}
            </Sec>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab==='stats'&&(
          <div>
            <Sec title="ผลสอบล่าสุด" icon="📊">
              {stats.length===0&&<div style={{fontSize:13,color:C.muted,textAlign:'center',padding:'20px'}}>ยังไม่มีข้อมูล</div>}
              {stats.map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:36,height:36,borderRadius:9,background:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:C.blue,flexShrink:0}}>{(r.school||'??').slice(0,2)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:C.text}}>{r.school} · {r.subject}</div>
                    <div style={{fontSize:11,color:C.muted}}>{r.created_at?.slice(0,16)} · {r.plan}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:(r.pct||0)>=70?C.green:C.red,flexShrink:0}}>{r.pct}%</div>
                </div>
              ))}
            </Sec>
          </div>
        )}
      </div>
    </div>
  )
}
