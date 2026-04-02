'use client'
// ════════════════════════════════════════════════════════
//  TiwChalet Admin Page  v1.0.0
//  ตั้งค่าระบบ · จัดการข้อสอบ · ดูสถิติ
// ════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react'

interface Settings {
  parent_pin: string
  full_version_pin: string
  full_version_days: number
  full_version_price: string
  full_version_enabled: boolean
  qr_code_image_url: string
  child_name: string
  child_avatar_url: string
  child_target_school: string
  admin_phone: string
  admin_email: string
  admin_line_id: string
}

const SCHOOLS   = ['สวนกุหลาบ','สามเสน','สาธิตจุฬา','สาธิตประสานมิตร','บดินทรเดชา','หอวัง']
const SUBJECTS  = ['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English']
const LEVELS    = ['ง่าย','ปานกลาง','ยาก','ยากมาก']
const YEARS     = ['2564','2565','2566','2567','2568']

function Section({title,icon,children}:{title:string,icon:string,children:React.ReactNode}) {
  const [open,setOpen] = useState(true)
  return (
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,marginBottom:12,overflow:'hidden'}}>
      <button onClick={()=>setOpen(p=>!p)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:15,fontWeight:700,color:'#0f172a'}}>
          <span>{icon}</span>{title}
        </div>
        <span style={{fontSize:13,color:'#94a3b8'}}>{open?'▲':'▼'}</span>
      </button>
      {open&&<div style={{padding:'0 16px 16px',borderTop:'1px solid #f1f5f9'}}>{children}</div>}
    </div>
  )
}

function Field({label,children}:{label:string,children:React.ReactNode}) {
  return (
    <div style={{marginBottom:12}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:'#64748b',marginBottom:5}}>{label}</label>
      {children}
    </div>
  )
}

const inp = {style:{width:'100%',padding:'9px 11px',borderRadius:9,border:'1.5px solid #e2e8f0',background:'#fafafa',fontFamily:'inherit',fontSize:14,color:'#0f172a',outline:'none'}}

export default function AdminPage() {
  const [pin,        setPin]        = useState('')
  const [authed,     setAuthed]     = useState(false)
  const [settings,   setSettings]   = useState<Settings|null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')
  const [activeTab,  setActiveTab]  = useState<'settings'|'questions'|'stats'>('settings')
  const [questions,  setQuestions]  = useState<any[]>([])
  const [newQ, setNewQ] = useState({school:'สวนกุหลาบ',year:'2566',subject:'คณิตศาสตร์',level:'ปานกลาง',text:'',optA:'',optB:'',optC:'',optD:'',ans:0,explain:''})
  const [addingQ, setAddingQ] = useState(false)
  const [stats, setStats] = useState<any[]>([])
  const [upgradeReqs, setUpgradeReqs] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const login = async () => {
    const res  = await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,type:'parent',clientId:'admin'})})
    const data = await res.json()
    if(data.ok){ setAuthed(true); loadSettings(pin) }
    else alert(data.error||'PIN ไม่ถูกต้อง')
  }

  const loadSettings = async (p:string) => {
    const res  = await fetch('/api/settings',{headers:{'x-admin-pin':p}})
    const data = await res.json()
    if(data.settings) setSettings(data.settings)
  }

  const loadQuestions = async () => {
    const res  = await fetch('/api/questions')
    const data = await res.json()
    if(data.questions) setQuestions(data.questions)
  }

  const loadStats = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data:r } = await sb.from('exam_results').select('*').order('created_at',{ascending:false}).limit(30)
      if(r) setStats(r)
      const { data:u } = await sb.from('upgrade_requests').select('*').order('created_at',{ascending:false}).limit(20)
      if(u) setUpgradeReqs(u)
    } catch(e){ console.error(e) }
  }

  useEffect(()=>{
    if(authed){ loadQuestions(); loadStats() }
  },[authed])

  const save = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const res  = await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':pin},body:JSON.stringify(settings)})
      const data = await res.json()
      setSaveMsg(data.ok?'บันทึกสำเร็จ ✓':'เกิดข้อผิดพลาด')
      setTimeout(()=>setSaveMsg(''),3000)
    } finally { setSaving(false) }
  }

  const addQuestion = async () => {
    if(!newQ.text||!newQ.optA||!newQ.optB) return
    setAddingQ(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      await sb.from('questions').insert({
        school:newQ.school, year:newQ.year, subject:newQ.subject, level:newQ.level,
        text:newQ.text, opt_a:newQ.optA, opt_b:newQ.optB, opt_c:newQ.optC, opt_d:newQ.optD,
        ans:newQ.ans, explain:newQ.explain, source:'admin',
      })
      setNewQ(p=>({...p,text:'',optA:'',optB:'',optC:'',optD:'',explain:'',ans:0}))
      loadQuestions()
      alert('เพิ่มข้อสอบสำเร็จ')
    } catch(e:any){ alert('Error: '+e.message) }
    finally { setAddingQ(false) }
  }

  const uploadQrImage = async (file:File) => {
    // Convert to base64 data URL (stored directly, or upload to Supabase Storage)
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      setSettings(p=>p?{...p, qr_code_image_url:url}:p)
    }
    reader.readAsDataURL(file)
  }

  const upd = (k:keyof Settings, v:any) => setSettings(p=>p?{...p,[k]:v}:p)

  // ── Login screen ──
  if(!authed) return (
    <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'Sarabun',sans-serif",padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 24px',width:'100%',maxWidth:320,textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,.1)'}}>
        <div style={{fontSize:36,marginBottom:12}}>⚙️</div>
        <div style={{fontSize:20,fontWeight:700,color:'#0f172a',marginBottom:4}}>Admin Panel</div>
        <div style={{fontSize:13,color:'#64748b',marginBottom:24}}>TiwChalet v1.0.0</div>
        <input value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} type="password" placeholder="PIN ผู้ปกครอง" maxLength={4} style={{...inp.style,textAlign:'center',fontSize:18,letterSpacing:8,marginBottom:12}}/>
        <button onClick={login} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:'#1e293b',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>เข้าสู่ระบบ</button>
        <div style={{fontSize:11,color:'#cbd5e1',marginTop:10}}>เริ่มต้น PIN: 1234</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100dvh',background:'#f8fafc',fontFamily:"'Sarabun',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Top bar */}
      <div style={{background:'#1e293b',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20}}>⚙️</span>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>Admin Panel</div>
            <div style={{fontSize:11,color:'#94a3b8'}}>TiwChalet v1.0.0</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href="/" target="_blank" style={{fontSize:12,padding:'6px 12px',borderRadius:8,border:'1px solid #475569',color:'#cbd5e1',textDecoration:'none'}}>← App</a>
          <button onClick={()=>setAuthed(false)} style={{fontSize:12,padding:'6px 12px',borderRadius:8,border:'1px solid #475569',background:'transparent',color:'#cbd5e1',cursor:'pointer',fontFamily:'inherit'}}>ออก</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'0 16px',display:'flex',gap:0}}>
        {([['settings','⚙️ ตั้งค่า'],['questions','📝 ข้อสอบ'],['stats','📊 สถิติ']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{padding:'12px 16px',border:'none',borderBottom:`3px solid ${activeTab===id?'#1e293b':'transparent'}`,background:'transparent',fontSize:14,fontWeight:activeTab===id?700:400,color:activeTab===id?'#0f172a':'#64748b',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{maxWidth:640,margin:'0 auto',padding:'16px 14px 40px'}}>

        {/* ── SETTINGS TAB ── */}
        {activeTab==='settings'&&settings&&(
          <div>
            <Section title="ข้อมูลลูก" icon="👶">
              <Field label="ชื่อลูก">
                <input value={settings.child_name} onChange={e=>upd('child_name',e.target.value)} {...inp}/>
              </Field>
              <Field label="URL รูปโปรไฟล์ลูก">
                <input value={settings.child_avatar_url} onChange={e=>upd('child_avatar_url',e.target.value)} placeholder="https://..." {...inp}/>
                {settings.child_avatar_url&&<img src={settings.child_avatar_url} alt="" style={{width:50,height:50,borderRadius:10,marginTop:6,objectFit:'cover'}}/>}
              </Field>
              <Field label="โรงเรียนเป้าหมาย">
                <select value={settings.child_target_school} onChange={e=>upd('child_target_school',e.target.value)} {...inp}>
                  {SCHOOLS.map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
            </Section>

            <Section title="รหัส PIN" icon="🔒">
              <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:10,padding:'10px 12px',marginBottom:12,fontSize:13,color:'#92400e'}}>
                ⚠️ เปลี่ยน PIN แล้วบันทึก จากนั้นต้อง login ใหม่ด้วย PIN ใหม่
              </div>
              <Field label="PIN ผู้ปกครอง (4 หลัก)">
                <input value={settings.parent_pin} onChange={e=>upd('parent_pin',e.target.value)} maxLength={4} type="password" placeholder="••••" {...inp}/>
              </Field>
              <Field label="PIN Full Version (4 หลัก) — ให้ลูกค้าหลังจ่ายเงิน">
                <input value={settings.full_version_pin} onChange={e=>upd('full_version_pin',e.target.value)} maxLength={4} type="password" placeholder="••••" {...inp}/>
              </Field>
            </Section>

            <Section title="Full Version" icon="⭐">
              <Field label="ราคา (บาท)">
                <input value={settings.full_version_price} onChange={e=>upd('full_version_price',e.target.value)} placeholder="299" {...inp}/>
              </Field>
              <Field label="จำนวนวันที่ได้">
                <input type="number" value={settings.full_version_days} onChange={e=>upd('full_version_days',Number(e.target.value))} min={1} max={365} {...inp}/>
              </Field>
              <Field label="เปิดขาย Full Version">
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  <input type="checkbox" checked={settings.full_version_enabled} onChange={e=>upd('full_version_enabled',e.target.checked)} style={{width:18,height:18}}/>
                  <span style={{fontSize:14,color:'#0f172a'}}>{settings.full_version_enabled?'เปิดขายอยู่':'ปิดขายชั่วคราว'}</span>
                </label>
              </Field>
            </Section>

            <Section title="QR Code ชำระเงิน" icon="💳">
              <Field label="รูป QR Code ธนาคาร">
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{ const f=e.target.files?.[0]; if(f)uploadQrImage(f) }}/>
                <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'10px',borderRadius:10,border:'2px dashed #cbd5e1',background:'#f8fafc',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:'#64748b',marginBottom:8}}>
                  📷 คลิกเพื่ออัพโหลดรูป QR Code
                </button>
                {settings.qr_code_image_url&&(
                  <div style={{textAlign:'center'}}>
                    <img src={settings.qr_code_image_url} alt="QR" style={{width:140,height:140,borderRadius:10,border:'1px solid #e2e8f0',objectFit:'contain'}}/>
                    <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>QR ปัจจุบัน</div>
                  </div>
                )}
                <div style={{marginTop:8}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>หรือใส่ URL รูป QR Code โดยตรง</label>
                  <input value={settings.qr_code_image_url} onChange={e=>upd('qr_code_image_url',e.target.value)} placeholder="https://..." {...inp}/>
                </div>
              </Field>
            </Section>

            <Section title="ข้อมูล Admin" icon="📞">
              <Field label="เบอร์โทร">
                <input value={settings.admin_phone} onChange={e=>upd('admin_phone',e.target.value)} placeholder="0XX-XXX-XXXX" {...inp}/>
              </Field>
              <Field label="LINE ID">
                <input value={settings.admin_line_id} onChange={e=>upd('admin_line_id',e.target.value)} placeholder="Oady" {...inp}/>
              </Field>
              <Field label="Email">
                <input value={settings.admin_email} onChange={e=>upd('admin_email',e.target.value)} placeholder="thitiphankk@gmail.com" {...inp}/>
              </Field>
            </Section>

            <div style={{position:'sticky',bottom:16}}>
              <button onClick={save} disabled={saving} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:saving?'#94a3b8':'#16a34a',color:'#fff',fontSize:15,fontWeight:700,cursor:saving?'default':'pointer',fontFamily:'inherit',boxShadow:'0 4px 12px rgba(22,163,74,.3)'}}>
                {saving?'กำลังบันทึก...':'💾 บันทึกการตั้งค่า'}
              </button>
              {saveMsg&&<div style={{textAlign:'center',fontSize:13,color:'#16a34a',marginTop:8,fontWeight:600}}>{saveMsg}</div>}
            </div>
          </div>
        )}

        {/* ── QUESTIONS TAB ── */}
        {activeTab==='questions'&&(
          <div>
            {/* Add new */}
            <Section title="เพิ่มข้อสอบใหม่" icon="➕">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <Field label="โรงเรียน">
                  <select value={newQ.school} onChange={e=>setNewQ(p=>({...p,school:e.target.value}))} {...inp}>
                    {SCHOOLS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="ปี">
                  <select value={newQ.year} onChange={e=>setNewQ(p=>({...p,year:e.target.value}))} {...inp}>
                    {YEARS.map(y=><option key={y}>{y}</option>)}
                  </select>
                </Field>
                <Field label="วิชา">
                  <select value={newQ.subject} onChange={e=>setNewQ(p=>({...p,subject:e.target.value}))} {...inp}>
                    {SUBJECTS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="ระดับ">
                  <select value={newQ.level} onChange={e=>setNewQ(p=>({...p,level:e.target.value}))} {...inp}>
                    {LEVELS.map(l=><option key={l}>{l}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="โจทย์ *">
                <textarea value={newQ.text} onChange={e=>setNewQ(p=>({...p,text:e.target.value}))} rows={3} placeholder="พิมพ์โจทย์ข้อสอบ..." {...inp}/>
              </Field>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {(['optA','optB','optC','optD'] as const).map((k,i)=>(
                  <Field key={k} label={`ตัวเลือก ${['ก','ข','ค','ง'][i]} ${i===newQ.ans?'✓ (เฉลย)':''}`}>
                    <input value={newQ[k]} onChange={e=>setNewQ(p=>({...p,[k]:e.target.value}))}
                      onFocus={()=>setNewQ(p=>({...p,ans:i}))}
                      placeholder={`ตัวเลือก ${['ก','ข','ค','ง'][i]}`}
                      {...inp} style={{...inp.style,borderColor:i===newQ.ans?'#16a34a':undefined,background:i===newQ.ans?'#dcfce7':undefined}}/>
                  </Field>
                ))}
              </div>
              <div style={{fontSize:12,color:'#64748b',marginBottom:8,textAlign:'center'}}>คลิกที่ช่องตัวเลือกเพื่อตั้งเป็นเฉลย</div>
              <Field label="คำอธิบายเฉลย">
                <input value={newQ.explain} onChange={e=>setNewQ(p=>({...p,explain:e.target.value}))} placeholder="อธิบายว่าทำไมถึงถูก..." {...inp}/>
              </Field>
              <button onClick={addQuestion} disabled={addingQ||!newQ.text} style={{width:'100%',padding:'12px',borderRadius:10,border:'none',background:addingQ||!newQ.text?'#94a3b8':'#1e293b',color:'#fff',fontSize:14,fontWeight:700,cursor:addingQ||!newQ.text?'default':'pointer',fontFamily:'inherit'}}>
                {addingQ?'กำลังเพิ่ม...':'➕ เพิ่มข้อสอบ'}
              </button>
            </Section>

            {/* Question list */}
            <Section title={`ข้อสอบทั้งหมด (${questions.length} ข้อ)`} icon="📋">
              <div style={{marginBottom:8,fontSize:13,color:'#64748b'}}>
                แหล่งข้อมูล: {questions.length>0?'Supabase DB + Static fallback':'Static fallback (ยังไม่ได้เชื่อม DB)'}
              </div>
              {questions.slice(0,10).map((q,i)=>(
                <div key={q.id||i} style={{padding:'10px 12px',borderRadius:9,border:'1px solid #f1f5f9',background:'#fafafa',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:'#eff6ff',color:'#1d4ed8',fontWeight:600}}>{q.subject}</span>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:'#f1f5f9',color:'#64748b'}}>{q.school}</span>
                    <span style={{fontSize:11,color:'#94a3b8'}}>{q.year}</span>
                  </div>
                  <div style={{fontSize:13,color:'#0f172a',lineHeight:1.5}}>{q.text?.slice(0,80)}{q.text?.length>80?'...':''}</div>
                </div>
              ))}
              {questions.length>10&&<div style={{textAlign:'center',fontSize:13,color:'#94a3b8',paddingTop:4}}>...และอีก {questions.length-10} ข้อ</div>}
            </Section>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab==='stats'&&(
          <div>
            <Section title="ผลสอบล่าสุด" icon="📊">
              {stats.length===0&&<div style={{fontSize:13,color:'#94a3b8',textAlign:'center',padding:'20px 0'}}>ยังไม่มีข้อมูล (ต้องเชื่อม Supabase)</div>}
              {stats.slice(0,15).map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #f1f5f9'}}>
                  <div style={{width:36,height:36,borderRadius:9,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>{r.school?.slice(0,2)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{r.school} · {r.subject}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{r.created_at?.slice(0,16)} · {r.plan}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:r.pct>=70?'#16a34a':'#dc2626',flexShrink:0}}>{r.pct}%</div>
                </div>
              ))}
            </Section>

            <Section title="คำขอ Upgrade" icon="💰">
              {upgradeReqs.length===0&&<div style={{fontSize:13,color:'#94a3b8',textAlign:'center',padding:'20px 0'}}>ยังไม่มีคำขอ</div>}
              {upgradeReqs.map((r,i)=>(
                <div key={i} style={{padding:'10px 12px',borderRadius:9,border:'1px solid #f1f5f9',background:'#fafafa',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{r.name}</span>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:20,background:r.status==='pending'?'#fef3c7':'#dcfce7',color:r.status==='pending'?'#92400e':'#14532d'}}>{r.status}</span>
                  </div>
                  <div style={{fontSize:12,color:'#64748b'}}>📱 {r.contact} · {r.created_at?.slice(0,10)}</div>
                  {r.note&&<div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>หมายเหตุ: {r.note}</div>}
                </div>
              ))}
            </Section>

            <Section title="ข้อมูล System" icon="🔧">
              <div style={{fontSize:13,color:'#374151',lineHeight:2}}>
                <div>📦 Version: 1.0.0</div>
                <div>🗄️ Supabase: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่า'}</div>
                <div>📋 GAS Endpoint: {process.env.GAS_ENDPOINT ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้ตั้งค่า'}</div>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
