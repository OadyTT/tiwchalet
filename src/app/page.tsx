'use client'
// ═══════════════════════════════════════════════════════
//  TiwChalet v2.0 — Three-mode app
//  mode: 'student' | 'parent' | 'admin'
//  PIN ผู้ปกครอง → parent mode
//  /admin-[secret] → admin page (แยก)
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Subject } from '@/types'

const VERSION = 'v2.0'
type Mode    = 'student' | 'parent'
type Screen  = 'home' | 'pick' | 'exam' | 'result' | 'progress' | 'upgrade' | 'settings' | 'compare'
type Plan    = 'trial' | 'full'

interface Question { id:string; text:string; opts?:string[]; opt_a?:string; opt_b?:string; opt_c?:string; opt_d?:string; ans:number; explain:string; subject:string; school:string; year:string; level:string }
interface ExamResult { id:string; school:string; subject:string; year:string; score:number; total:number; pct:number; timeUsed:number; plan:Plan; createdAt:string }
interface AppCfg { childName:string; childAvatarUrl:string; childTargetSchool:string; qrCodeImageUrl:string; adminPhone:string; adminEmail:string; adminLineId:string; fullVersionPrice:string; fullVersionDays:number }
interface BackupLog { last_backup:string; rows_results:number; rows_upgrades:number; rows_questions:number; gas_ok:boolean }

const SCHOOLS  = ['สวนกุหลาบ','สามเสน','สาธิตจุฬา','สาธิตประสานมิตร','บดินทรเดชา','หอวัง']
const SUBJECTS: Subject[] = ['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English']
const SUBJ_ICON: Record<string,string> = { 'คณิตศาสตร์':'➗','วิทยาศาสตร์':'🔬','ภาษาไทย':'📖','English':'🇬🇧' }
const TRIAL_EXAM_LIMIT   = 3
const TRIAL_SCHOOL_LIMIT = 2
const C = { green:'#16a34a',greenL:'#dcfce7',greenD:'#14532d', navy:'#1e293b', gold:'#d97706',goldL:'#fef3c7', red:'#dc2626',redL:'#fee2e2', blue:'#1d4ed8',blueL:'#eff6ff', border:'#e2e8f0', muted:'#64748b', text:'#0f172a' }

const fmtSec  = (s:number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const nowStr  = () => new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'})
const persist = {
  load: () => { try { const d=localStorage.getItem('tc-v2'); return d?JSON.parse(d):{} } catch{return {}} },
  save: (d:any) => { try { localStorage.setItem('tc-v2',JSON.stringify(d)) } catch{} }
}

// ─── PIN MODAL ────────────────────────────────────────
function PinModal({title, onSuccess, onCancel}:{title:string; onSuccess:(t:string,d?:any)=>void; onCancel:()=>void}) {
  const [pin,setPinVal]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState(''); const [shake,setShake]=useState(false)
  const cid = useRef(Math.random().toString(36).slice(2))
  const tap = async (d:string) => {
    if(busy) return
    const next = d==='⌫'?pin.slice(0,-1):pin+d
    if(next.length>4) return
    setPinVal(next); setErr('')
    if(next.length===4) {
      setBusy(true)
      try {
        const res  = await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:next,type:'parent',clientId:cid.current})})
        const data = await res.json()
        if(data.ok) { onSuccess(data.token,data) }
        else { setShake(true); setErr(data.error||'PIN ไม่ถูกต้อง'); setPinVal(''); setTimeout(()=>setShake(false),400) }
      } catch { setErr('เชื่อมต่อไม่ได้'); setPinVal('') }
      finally { setBusy(false) }
    }
  }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 24px',width:'100%',maxWidth:300,textAlign:'center',animation:shake?'shake .35s ease':undefined}}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
        <div style={{fontSize:32,marginBottom:10}}>🔒</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:4,color:C.text}}>{title}</div>
        <div style={{fontSize:13,color:err?C.red:C.muted,marginBottom:20,minHeight:18}}>{err||'ใส่รหัส 4 หลัก'}</div>
        <div style={{display:'flex',justifyContent:'center',gap:14,marginBottom:24}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:13,height:13,borderRadius:'50%',background:i<pin.length?C.navy:'#e2e8f0',transition:'background .12s'}}/>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i)=>d===''?<div key={i}/>:
            <button key={i} onClick={()=>tap(d)} disabled={busy} style={{height:50,borderRadius:12,border:'1px solid #e2e8f0',background:'#fafafa',fontSize:d==='⌫'?16:19,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:C.text}}>{d}</button>
          )}
        </div>
        <button onClick={onCancel} style={{background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>ยกเลิก</button>
      </div>
    </div>
  )
}

// ─── PAYMENT MODAL (slip upload) ─────────────────────
function PaymentModal({cfg,onClose}:{cfg:AppCfg|null;onClose:()=>void}) {
  const [step,setStep] = useState<'info'|'slip'|'done'>('info')
  const [name,setName]=useState(''); const [contact,setContact]=useState(''); const [note,setNote]=useState(''); const [amount,setAmount]=useState('')
  const [slipB64,setSlipB64]=useState(''); const [slipMime,setSlipMime]=useState(''); const [slipPreview,setSlipPreview]=useState('')
  const [sending,setSending]=useState(false); const [reqId,setReqId]=useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const onSlip = (e:React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setSlipPreview(url)
      setSlipMime(f.type)
      setSlipB64(url.split(',')[1])
    }
    reader.readAsDataURL(f)
  }

  const submit = async () => {
    if(!name.trim()||!slipB64){ alert('กรุณากรอกชื่อและแนบสลิป'); return }
    setSending(true)
    try {
      const res  = await fetch('/api/upload-slip',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({imageBase64:slipB64,mimeType:slipMime,name,contact,note,amount})})
      const data = await res.json()
      if(data.ok){ setReqId(data.requestId); setStep('done') }
      else alert(data.error||'เกิดข้อผิดพลาด')
    } catch{ alert('เชื่อมต่อไม่ได้') }
    finally{ setSending(false) }
  }

  const price     = cfg?.fullVersionPrice || '299'
  const days      = cfg?.fullVersionDays  || 30
  const phone     = cfg?.adminPhone       || '-'
  const lineId    = cfg?.adminLineId      || 'Oady'
  const email     = cfg?.adminEmail       || 'thitiphankk@gmail.com'
  const qrUrl     = cfg?.qrCodeImageUrl   || ''

  const inp = {style:{width:'100%',padding:'10px 12px',borderRadius:10,border:'1.5px solid #e2e8f0',background:'#fafafa',fontFamily:'inherit',fontSize:14,color:C.text,outline:'none',marginBottom:10} as React.CSSProperties}

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:600,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'28px 20px 32px',width:'100%',maxWidth:480,maxHeight:'95dvh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700,color:C.text}}>⭐ Full Version</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.muted}}>×</button>
        </div>

        {step==='info'&&(
          <div>
            <div style={{background:C.goldL,border:`1px solid #fcd34d`,borderRadius:12,padding:'14px',textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:26,fontWeight:700,color:'#92400e'}}>{price} บาท / {days} วัน</div>
              <div style={{fontSize:13,color:'#b45309',marginTop:2}}>ไม่ต่ออายุอัตโนมัติ</div>
            </div>
            {['ข้อสอบทุกโรงเรียน ไม่จำกัด','ทุก 4 วิชา (คณิต วิทย์ ไทย English)','Dashboard วิเคราะห์ผลคะแนน','Backup ไป Google Sheets','แจ้งเตือน LINE รายสัปดาห์'].map(b=>(
              <div key={b} style={{display:'flex',gap:8,marginBottom:6,fontSize:13,color:C.greenD}}><span style={{color:C.green,fontWeight:700}}>✓</span>{b}</div>
            ))}
            {qrUrl&&(
              <div style={{textAlign:'center',margin:'16px 0 8px'}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:C.text}}>โอนเงินผ่าน QR Code</div>
                <img src={qrUrl} alt="QR" style={{width:160,height:160,borderRadius:12,border:'1px solid #e2e8f0',objectFit:'contain'}}/>
              </div>
            )}
            <div style={{background:C.blueL,borderRadius:10,padding:'12px',marginBottom:16,fontSize:13,color:C.blue}}>
              📱 LINE: @{lineId} · 📞 {phone}<br/>📧 {email}
            </div>
            <button onClick={()=>setStep('slip')} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              แนบสลิปชำระเงิน →
            </button>
          </div>
        )}

        {step==='slip'&&(
          <div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:14,color:C.text}}>กรอกข้อมูลและแนบสลิป</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อ-นามสกุล *" {...inp}/>
            <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="LINE ID หรือเบอร์โทร" {...inp}/>
            <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`จำนวนเงิน (${price} บาท)`} type="number" {...inp}/>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" rows={2} {...inp as any}/>
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={onSlip}/>
            <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'12px',borderRadius:10,border:'2px dashed #cbd5e1',background:'#fafafa',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:C.muted,marginBottom:slipPreview?8:16}}>
              📎 {slipPreview?'เปลี่ยนสลิป':'เลือกรูปสลิป *'}
            </button>
            {slipPreview&&<img src={slipPreview} alt="slip" style={{width:'100%',maxHeight:200,objectFit:'contain',borderRadius:10,border:'1px solid #e2e8f0',marginBottom:12}}/>}
            <button onClick={submit} disabled={sending||!name.trim()||!slipB64} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:name.trim()&&slipB64?C.green:'#d1d5db',color:'#fff',fontSize:15,fontWeight:700,cursor:name.trim()&&slipB64?'pointer':'default',fontFamily:'inherit'}}>
              {sending?'กำลังส่ง...':'ส่งสลิปให้ Admin'}
            </button>
          </div>
        )}

        {step==='done'&&(
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontSize:18,fontWeight:700,marginBottom:8,color:C.text}}>ส่งสลิปแล้ว!</div>
            <div style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:16}}>Admin จะตรวจสอบและส่ง PIN Full Version<br/>ให้ทาง LINE ภายใน 24 ชั่วโมง</div>
            <div style={{fontSize:12,color:C.blue,marginBottom:20}}>Reference ID: {reqId}</div>
            <button onClick={onClose} style={{padding:'10px 28px',borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>ปิด</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── COMPARE MODAL (trial vs full) ───────────────────
function CompareModal({onClose,onPay}:{onClose:()=>void;onPay:()=>void}) {
  const rows = [
    {f:'โรงเรียนที่เลือกได้',t:`${TRIAL_SCHOOL_LIMIT} โรงแรก`,u:'ทุก 6 โรงเรียน'},
    {f:'จำนวนข้อสอบ/วัน',t:`${TRIAL_EXAM_LIMIT} ชุด/วัน`,u:'ไม่จำกัด'},
    {f:'วิชา',t:'ครบทุกวิชา',u:'ครบทุกวิชา'},
    {f:'ดูเฉลยละเอียด',t:'✓',u:'✓'},
    {f:'Dashboard ผู้ปกครอง',t:'จำกัด',u:'เต็มรูปแบบ'},
    {f:'ประวัติผลสอบ',t:'7 วัน',u:'ตลอดปี'},
    {f:'Backup Google Sheets',t:'✗',u:'✓'},
    {f:'แจ้งเตือน LINE',t:'✗',u:'✓'},
    {f:'รายงานรายสัปดาห์',t:'✗',u:'✓'},
  ]
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:420,maxHeight:'92dvh',overflowY:'auto',padding:'24px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div style={{fontSize:17,fontWeight:700,color:C.text}}>ทดลอง vs Full Version</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.muted}}>×</button>
        </div>
        <div style={{border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',marginBottom:20}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr'}}>
            {['ฟีเจอร์','ทดลอง','Full ⭐'].map((h,i)=>(
              <div key={i} style={{padding:'9px 10px',fontSize:12,fontWeight:700,color:i===2?'#8b6914':C.muted,background:i===2?C.goldL:'#f8fafc',textAlign:i>0?'center':'left'}}>
                {h}
              </div>
            ))}
          </div>
          {rows.map((r,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderTop:'1px solid #f1f5f9'}}>
              <div style={{padding:'8px 10px',fontSize:12,color:C.text}}>{r.f}</div>
              <div style={{padding:'8px 10px',fontSize:12,color:r.t==='✗'?C.red:r.t==='✓'?C.green:C.muted,textAlign:'center'}}>{r.t}</div>
              <div style={{padding:'8px 10px',fontSize:12,fontWeight:500,textAlign:'center',background:C.goldL,color:r.u==='✓'?C.green:r.u==='✗'?C.red:'#8b6914'}}>{r.u}</div>
            </div>
          ))}
        </div>
        <button onClick={onPay} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>
          สมัคร Full Version →
        </button>
        <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:12,border:'1px solid #e2e8f0',background:'transparent',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
          ใช้ต่อแบบทดลอง
        </button>
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────
export default function Home() {
  const [mode,    setMode]    = useState<Mode>('student')
  const [plan,    setPlan]    = useState<Plan>('trial')
  const [screen,  setScreen]  = useState<Screen>('home')
  const [cfg,     setCfg]     = useState<AppCfg|null>(null)
  const [backupLog, setBackupLog] = useState<BackupLog|null>(null)

  const [showPin,     setShowPin]     = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showCompare, setShowCompare] = useState(false)

  const [fullExpiry,  setFullExpiry]  = useState<string|null>(null)
  const daysLeft = fullExpiry ? Math.max(0,Math.ceil((new Date(fullExpiry).getTime()-Date.now())/86400000)) : 0
  const isFull = plan==='full' && daysLeft>0

  const [selSchool,  setSelSchool]  = useState('')
  const [selSubject, setSelSubject] = useState<Subject>('คณิตศาสตร์')
  const [selYear,    setSelYear]    = useState('2566')
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [answers,    setAnswers]    = useState<Record<string,number>>({})
  const [loading,    setLoading]    = useState(false)
  const [loadErr,    setLoadErr]    = useState('')
  const [timeLeft,   setTimeLeft]   = useState(0)
  const [timerOn,    setTimerOn]    = useState(false)
  const [history,    setHistory]    = useState<ExamResult[]>([])
  const [examCount,  setExamCount]  = useState(0)

  const [parentPin, setParentPin]   = useState('')
  const [backupBusy,setBackupBusy] = useState(false)
  const [backupMsg, setBackupMsg]  = useState('')

  // load persisted
  useEffect(()=>{
    const d = persist.load()
    if(d.plan)       setPlan(d.plan)
    if(d.fullExpiry) setFullExpiry(d.fullExpiry)
    if(d.history)    setHistory(d.history)
    if(d.examCount)  setExamCount(d.examCount)
    if(d.pin)        setParentPin(d.pin)
    // load settings
    fetch('/api/settings').then(r=>r.json()).then(d=>{
      if(d.settings) {
        const s=d.settings
        setCfg({childName:s.child_name,childAvatarUrl:s.child_avatar_url,childTargetSchool:s.child_target_school,qrCodeImageUrl:s.qr_code_image_url,adminPhone:s.admin_phone,adminEmail:s.admin_email,adminLineId:s.admin_line_id,fullVersionPrice:s.full_version_price,fullVersionDays:s.full_version_days||30})
      }
    }).catch(()=>{})
  },[])

  // auto-expire full
  useEffect(()=>{
    if(plan==='full'&&fullExpiry&&new Date(fullExpiry)<new Date()){setPlan('trial');setFullExpiry(null)}
  },[plan,fullExpiry])

  // persist on change
  useEffect(()=>{ persist.save({plan,fullExpiry,history,examCount,pin:parentPin}) },[plan,fullExpiry,history,examCount,parentPin])

  // timer
  useEffect(()=>{
    if(!timerOn||timeLeft<=0) return
    const t=setInterval(()=>setTimeLeft(p=>{ if(p<=1){clearInterval(t);doSubmit();return 0} return p-1 }),1000)
    return ()=>clearInterval(t)
  },[timerOn,timeLeft])

  const unlockParent = (_tok:string,data?:any) => {
    setMode('parent')
    setShowPin(false)
    if(data?.token) setParentPin(data.token)
    if(data?.settings) {
      setCfg(prev=>prev?{...prev,...{childName:data.settings.childName,childAvatarUrl:data.settings.childAvatarUrl,childTargetSchool:data.settings.childTargetSchool,qrCodeImageUrl:data.settings.qrCodeImageUrl,adminPhone:data.settings.adminPhone,adminEmail:data.settings.adminEmail,adminLineId:data.settings.adminLineId,fullVersionPrice:data.settings.fullVersionPrice}}:null)
    }
    if(data?.fullVersionDays) {
      const exp=new Date(); exp.setDate(exp.getDate()+data.fullVersionDays)
    }
  }
  const lockParent = () => { setMode('student'); setParentPin('') }

  const unlockFull = (_tok:string,data?:any) => {
    const days = data?.fullVersionDays||30
    const exp  = new Date(); exp.setDate(exp.getDate()+days)
    setPlan('full'); setFullExpiry(exp.toISOString())
    setShowPin(false)
  }

  const canExam           = isFull||examCount<TRIAL_EXAM_LIMIT
  const accessibleSchools = isFull?SCHOOLS:SCHOOLS.slice(0,TRIAL_SCHOOL_LIMIT)

  const loadExam = async () => {
    if(!selSchool||!selSubject){setLoadErr('เลือกโรงเรียนและวิชา');return}
    if(!canExam){setShowCompare(true);return}
    setLoading(true); setLoadErr(''); setQuestions([]); setAnswers({})
    try {
      const p=new URLSearchParams({school:selSchool,subject:selSubject,year:selYear})
      const res=await fetch(`/api/questions?${p}`)
      const data=await res.json()
      if(!data.ok||!data.questions.length) throw new Error(data.error||'ไม่พบข้อสอบ')
      const qs = data.questions.map((q:Question)=>({...q,opts:q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']}))
      setQuestions(qs); setTimeLeft(qs.length*90); setTimerOn(true); setExamCount(p2=>p2+1); setScreen('exam')
    } catch(e:any){ setLoadErr(e.message) }
    finally { setLoading(false) }
  }

  const doSubmit = useCallback(()=>{
    if(!questions.length||!selSchool||!selSubject) return
    setTimerOn(false)
    const sc = questions.filter(q=>answers[q.id]===q.ans).length
    const tu = questions.length*90-timeLeft
    const r: ExamResult = {id:Date.now().toString(),school:selSchool,subject:selSubject,year:selYear,score:sc,total:questions.length,pct:Math.round(sc/questions.length*100),timeUsed:tu,plan,createdAt:nowStr()}
    setHistory(p=>[r,...p].slice(0,50)); setScreen('result')
    fetch('/api/save-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selSchool,subject:selSubject,year:selYear,score:sc,total:questions.length,timeUsed:tu,plan})}).catch(()=>{})
  },[questions,selSchool,selSubject,selYear,answers,timeLeft,plan])

  const doBackup = async () => {
    if(!parentPin){ alert('ต้องเข้าโหมดผู้ปกครองก่อน'); return }
    setBackupBusy(true); setBackupMsg('')
    try {
      const res  = await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':parentPin},body:JSON.stringify({})})
      const data = await res.json()
      setBackupMsg(data.message||'Backup เสร็จแล้ว')
      if(data.ok) {
        fetch('/api/backup',{headers:{'x-admin-pin':parentPin}}).then(r=>r.json()).then(d=>{ if(d.log) setBackupLog(d.log) }).catch(()=>{})
      }
    } catch { setBackupMsg('เชื่อมต่อไม่ได้') }
    finally { setBackupBusy(false) }
  }

  const latest = history[0]
  const avgPct = history.length?Math.round(history.reduce((a,r)=>a+r.pct,0)/history.length):0
  const childName = cfg?.childName||'น้องมิ้น'
  const childAvatar=cfg?.childAvatarUrl||''

  // ─── RENDER ───────────────────────────────────────
  return (
    <div style={{minHeight:'100dvh',background:'#f8fafc',display:'flex',flexDirection:'column',fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        button:active{transform:scale(.97)}
        input:focus,select:focus,textarea:focus{border-color:#16a34a!important;outline:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .25s ease both}
        .spin{animation:spin .8s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {showPin && (
        plan==='trial' && screen==='upgrade'
          ? <PinModal title="ปลดล็อก Full Version" onSuccess={unlockFull} onCancel={()=>setShowPin(false)}/>
          : <PinModal title="โหมดผู้ปกครอง" onSuccess={unlockParent} onCancel={()=>setShowPin(false)}/>
      )}
      {showPayment && <PaymentModal cfg={cfg} onClose={()=>setShowPayment(false)}/>}
      {showCompare && <CompareModal onClose={()=>setShowCompare(false)} onPay={()=>{setShowCompare(false);setShowPayment(true)}}/>}

      {/* ── TOP BAR ── */}
      {screen!=='exam'&&(
        <div style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            {childAvatar
              ?<img src={childAvatar} alt="" style={{width:34,height:34,borderRadius:10,objectFit:'cover'}}/>
              :<div style={{width:34,height:34,borderRadius:10,background:mode==='parent'?C.greenL:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                {mode==='parent'?'👩':'🧒'}
              </div>}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:14,fontWeight:600,color:C.text}}>{mode==='parent'?'คุณแม่':childName}</span>
                {isFull
                  ?<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:C.goldL,color:'#8b6914',border:'1px solid #fcd34d',fontWeight:600}}>⭐ Full {daysLeft}วัน</span>
                  :<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'#f1f5f9',color:C.muted,fontWeight:500}}>ทดลอง</span>}
              </div>
              <div style={{fontSize:11,color:C.muted}}>{cfg?.childTargetSchool||'ติวเข้า ม.1'} · {VERSION}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {!isFull&&<button onClick={()=>setShowCompare(true)} style={{fontSize:11,padding:'5px 9px',borderRadius:8,border:'1px solid #fcd34d',background:C.goldL,color:'#92400e',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>⭐</button>}
            {/* ปุ่มผู้ปกครอง มุมขวาบน */}
            <button onClick={()=>mode==='parent'?lockParent():setShowPin(true)}
              style={{fontSize:11,padding:'5px 10px',borderRadius:8,border:`1px solid ${mode==='parent'?'#86efac':'#e2e8f0'}`,background:mode==='parent'?C.greenL:'#f8fafc',color:mode==='parent'?C.greenD:C.muted,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
              {mode==='parent'?'🔓 ออก':'🔒 ผู้ปกครอง'}
            </button>
          </div>
        </div>
      )}

      {/* BANNERS */}
      {screen!=='exam'&&!isFull&&(
        <div style={{background:C.goldL,borderBottom:'1px solid #fde68a',padding:'6px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:12,color:'#92400e'}}>ทดลองใช้ · ข้อสอบวันนี้ {examCount}/{TRIAL_EXAM_LIMIT} ชุด · {TRIAL_SCHOOL_LIMIT} โรงเรียนแรก</span>
          <button onClick={()=>setShowCompare(true)} style={{fontSize:11,padding:'3px 9px',borderRadius:6,border:'none',background:C.gold,color:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>เปรียบเทียบ</button>
        </div>
      )}
      {screen!=='exam'&&mode==='parent'&&(
        <div style={{background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',padding:'5px 14px',fontSize:12,color:C.greenD}}>
          🔓 โหมดผู้ปกครอง — ดูแดชบอร์ดและตั้งค่าได้ที่นี่
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{maxWidth:480,margin:'0 auto',padding:'14px 14px 76px',width:'100%',flex:1}}>

        {/* ── HOME ── */}
        {screen==='home'&&(
          <div className="fu">
            {/* STUDENT HOME */}
            {mode==='student'&&(
              <div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:2}}>สวัสดี {childName} 👋</div>
                  <div style={{fontSize:14,color:C.muted}}>วันนี้จะฝึกทำข้อสอบอะไร?</div>
                </div>

                {/* stats */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:9,marginBottom:16}}>
                  {[
                    {v:history.length||'—',l:'ชุดที่ทำ',c:C.blue,bg:C.blueL},
                    {v:history.length?avgPct+'%':'—',l:'คะแนนเฉลี่ย',c:C.green,bg:C.greenL},
                    {v:isFull?daysLeft+'วัน':TRIAL_EXAM_LIMIT-examCount+'',l:isFull?'Full เหลือ':'เหลือวันนี้',c:C.gold,bg:C.goldL},
                  ].map(s=>(
                    <div key={s.l} style={{background:s.bg,borderRadius:12,padding:'13px 8px',textAlign:'center'}}>
                      <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:11,color:s.c,opacity:.75,marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                <button onClick={()=>setScreen('pick')} style={{width:'100%',background:C.navy,color:'#fff',border:'none',borderRadius:16,padding:'18px 16px',cursor:'pointer',fontFamily:'inherit',marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{textAlign:'left'}}>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:2}}>เริ่มทำข้อสอบ</div>
                    <div style={{fontSize:12,opacity:.65}}>4 วิชา · 6 โรงเรียนดัง กทม.</div>
                  </div>
                  <span style={{fontSize:30}}>📝</span>
                </button>

                {latest&&(
                  <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'13px',marginBottom:10}}>
                    <div style={{fontSize:12,color:C.muted,marginBottom:7}}>ครั้งล่าสุด</div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:C.blueL,border:`2px solid ${C.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blue,flexShrink:0}}>{latest.school.slice(0,2)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{latest.school}</div>
                        <div style={{fontSize:11,color:C.muted}}>{SUBJ_ICON[latest.subject]} {latest.subject} · {latest.year}</div>
                      </div>
                      <div style={{fontSize:20,fontWeight:700,color:latest.pct>=70?C.green:C.red}}>{latest.pct}%</div>
                    </div>
                    <button onClick={()=>setScreen('result')} style={{marginTop:8,width:'100%',padding:'7px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',color:C.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>ดูเฉลยอีกครั้ง</button>
                  </div>
                )}

                {!isFull&&(
                  <button onClick={()=>setShowCompare(true)} style={{width:'100%',padding:14,borderRadius:14,border:`2px solid #fcd34d`,background:C.goldL,color:'#78350f',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                    ⭐ เปรียบเทียบ ทดลอง vs Full Version
                  </button>
                )}
              </div>
            )}

            {/* PARENT HOME */}
            {mode==='parent'&&(
              <div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:2}}>แดชบอร์ด 👩</div>
                  <div style={{fontSize:13,color:C.muted}}>ติดตามความก้าวหน้าของ {childName}</div>
                </div>

                {/* parent stats */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:9,marginBottom:14}}>
                  {[
                    {v:history.length,l:'ชุดข้อสอบรวม',c:C.blue,bg:C.blueL},
                    {v:history.length?avgPct+'%':'—',l:'คะแนนเฉลี่ย',c:history.length?(avgPct>=70?C.green:C.red):C.muted,bg:history.length?(avgPct>=70?C.greenL:C.redL):C.goldL},
                    {v:history.filter(r=>r.pct>=80).length,l:'คะแนน ≥80%',c:C.green,bg:C.greenL},
                    {v:history.filter(r=>r.pct<60).length||'ดี',l:'ต้องปรับปรุง',c:history.filter(r=>r.pct<60).length?C.red:C.green,bg:history.filter(r=>r.pct<60).length?C.redL:C.greenL},
                  ].map(s=>(
                    <div key={s.l} style={{background:s.bg,borderRadius:12,padding:'13px 14px'}}>
                      <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:12,color:s.c,opacity:.75,marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* per-subject breakdown */}
                {history.length>0&&(
                  <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'13px',marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>คะแนนแต่ละวิชา</div>
                    {SUBJECTS.map(subj=>{
                      const rows = history.filter(r=>r.subject===subj)
                      if(!rows.length) return null
                      const avg = Math.round(rows.reduce((a,r)=>a+r.pct,0)/rows.length)
                      return (
                        <div key={subj} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                          <div style={{fontSize:13,width:20}}>{SUBJ_ICON[subj]}</div>
                          <div style={{fontSize:13,color:C.text,width:100,flexShrink:0}}>{subj}</div>
                          <div style={{flex:1,height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${avg}%`,background:avg>=70?C.green:C.red,borderRadius:4,transition:'width .5s'}}/>
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:avg>=70?C.green:C.red,width:36,textAlign:'right'}}>{avg}%</div>
                        </div>
                      )
                    }).filter(Boolean)}
                  </div>
                )}

                {/* recent history */}
                {history.length>0&&(
                  <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'13px',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>ประวัติล่าสุด</div>
                      <button onClick={()=>setScreen('progress')} style={{fontSize:12,color:C.blue,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>ดูทั้งหมด →</button>
                    </div>
                    {history.slice(0,4).map(r=>(
                      <div key={r.id} style={{display:'flex',alignItems:'center',gap:9,padding:'6px 0',borderBottom:'1px solid #f8fafc'}}>
                        <div style={{width:32,height:32,borderRadius:9,background:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:C.blue,flexShrink:0}}>{r.school.slice(0,2)}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:500,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.school} · {SUBJ_ICON[r.subject]} {r.subject}</div>
                          <div style={{fontSize:11,color:C.muted}}>{r.createdAt}</div>
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:r.pct>=70?C.green:C.red,flexShrink:0}}>{r.pct}%</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* quick actions */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:12}}>
                  {[
                    {l:'ตั้งค่า',i:'⚙️',s:'settings' as Screen},
                    {l:'Full Version',i:'⭐',s:'upgrade' as Screen},
                    {l:'ผลสอบทั้งหมด',i:'📊',s:'progress' as Screen},
                    {l:'ทำข้อสอบ',i:'📝',s:'pick' as Screen},
                  ].map(b=>(
                    <button key={b.l} onClick={()=>setScreen(b.s)} style={{display:'flex',alignItems:'center',gap:8,padding:'12px',borderRadius:12,border:'1px solid #e2e8f0',background:'#fff',color:C.text,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:500}}>
                      <span style={{fontSize:20}}>{b.i}</span>{b.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXAM PICK ── */}
        {screen==='pick'&&(
          <div className="fu">
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
              <div><div style={{fontSize:17,fontWeight:700,color:C.text}}>เลือกข้อสอบ</div><div style={{fontSize:11,color:C.muted}}>โรงเรียนดัง กทม. · 4 วิชา</div></div>
            </div>
            <div style={{display:'flex',gap:7,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
              {['2564','2565','2566','2567'].map(y=>(
                <button key={y} onClick={()=>setSelYear(y)} style={{flexShrink:0,padding:'6px 14px',borderRadius:20,border:`1.5px solid ${selYear===y?C.navy:'#e2e8f0'}`,background:selYear===y?C.navy:'#fff',color:selYear===y?'#fff':C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:selYear===y?600:400}}>ปี {y}</button>
              ))}
            </div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
              {SUBJECTS.map(s=>(
                <button key={s} onClick={()=>setSelSubject(s)} style={{padding:'7px 14px',borderRadius:20,border:`1.5px solid ${selSubject===s?C.navy:'#e2e8f0'}`,background:selSubject===s?C.navy:'#fff',color:selSubject===s?'#fff':C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:selSubject===s?600:400}}>
                  {SUBJ_ICON[s]} {s}
                </button>
              ))}
            </div>
            <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:8,letterSpacing:'.05em'}}>โรงเรียน</div>
            <div style={{display:'flex',flexDirection:'column',gap:9,marginBottom:20}}>
              {SCHOOLS.map((sch,i)=>{
                const locked=!isFull&&i>=TRIAL_SCHOOL_LIMIT; const sel=selSchool===sch
                return (
                  <div key={sch} onClick={()=>{if(locked){setShowCompare(true);return};setSelSchool(sch)}}
                    style={{background:sel?C.blueL:'#fff',border:`2px solid ${sel?C.blue:'#e2e8f0'}`,borderRadius:14,padding:'12px 14px',cursor:locked?'default':'pointer',opacity:locked?.55:1,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:9}}>
                      <div style={{width:34,height:34,borderRadius:9,background:C.blueL,border:`2px solid ${C.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blue,flexShrink:0}}>{sch.slice(0,2)}</div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{sch}</div>
                    </div>
                    {locked?<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:C.goldL,color:'#92400e',border:'1px solid #fcd34d',fontWeight:600}}>⭐Full</span>
                      :<div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${sel?C.blue:'#e2e8f0'}`,background:sel?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{sel&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}</div>}
                  </div>
                )
              })}
            </div>
            <div style={{position:'sticky',bottom:72}}>
              <button onClick={loadExam} disabled={!selSchool||loading} style={{width:'100%',padding:15,borderRadius:14,border:'none',background:selSchool&&!loading?C.navy:'#d1d5db',color:'#fff',fontSize:15,fontWeight:700,cursor:selSchool&&!loading?'pointer':'default',fontFamily:'inherit',boxShadow:selSchool?'0 4px 14px rgba(30,41,59,.25)':'none'}}>
                {loading?<><span className="spin">⟳</span> กำลังโหลด...</>:selSchool?`เริ่ม — ${selSchool} · ${SUBJ_ICON[selSubject]} ${selSubject}`:'เลือกโรงเรียน'}
              </button>
              {loadErr&&<div style={{fontSize:12,color:C.red,textAlign:'center',marginTop:6}}>{loadErr}</div>}
            </div>
          </div>
        )}

        {/* ── EXAM DO ── */}
        {screen==='exam'&&questions.length>0&&(
          <div className="fu">
            <div style={{background:'#fff',borderRadius:14,padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',border:'1px solid #e2e8f0'}}>
              <div><div style={{fontSize:14,fontWeight:700,color:C.text}}>{selSchool} · {SUBJ_ICON[selSubject]} {selSubject}</div><div style={{fontSize:11,color:C.muted}}>ตอบแล้ว {Object.keys(answers).length}/{questions.length} ข้อ</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:22,fontWeight:700,color:timeLeft<60?C.red:C.green,fontVariantNumeric:'tabular-nums'}}>{fmtSec(timeLeft)}</div><div style={{fontSize:10,color:C.muted}}>เหลือเวลา</div></div>
            </div>
            <div style={{height:4,background:'#f1f5f9',borderRadius:2,marginBottom:14,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Object.keys(answers).length/questions.length*100}%`,background:C.navy,transition:'width .3s'}}/>
            </div>
            {questions.map(q=>{
              const opts = q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']
              return (
                <div key={q.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:10,border:`2px solid ${answers[q.id]!==undefined?C.navy:'#e2e8f0'}`,transition:'border-color .15s'}}>
                  <div style={{display:'flex',gap:8,marginBottom:11}}>
                    <div style={{width:24,height:24,borderRadius:7,background:answers[q.id]!==undefined?C.navy:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:answers[q.id]!==undefined?'#fff':C.muted,flexShrink:0}}>{q.id.toString().slice(-2)}</div>
                    <div><div style={{fontSize:10,color:C.muted,marginBottom:3}}>{q.level}</div><div style={{fontSize:14,fontWeight:500,color:C.text,lineHeight:1.6}}>{q.text}</div></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                    {opts.map((opt,oi)=>{
                      const sel=answers[q.id]===oi
                      return <button key={oi} onClick={()=>setAnswers(p=>({...p,[q.id]:oi}))} style={{padding:'10px 12px',borderRadius:10,border:`2px solid ${sel?C.navy:'#e2e8f0'}`,background:sel?C.navy:'#fafafa',color:sel?'#fff':C.text,fontSize:13,cursor:'pointer',fontFamily:'inherit',textAlign:'left',fontWeight:sel?600:400,transition:'all .12s'}}>{opt}</button>
                    })}
                  </div>
                </div>
              )
            })}
            <button onClick={doSubmit} disabled={Object.keys(answers).length<questions.length} style={{width:'100%',padding:15,borderRadius:14,border:'none',background:Object.keys(answers).length===questions.length?C.navy:'#d1d5db',color:'#fff',fontSize:15,fontWeight:700,cursor:Object.keys(answers).length===questions.length?'pointer':'default',fontFamily:'inherit',marginTop:4,boxShadow:Object.keys(answers).length===questions.length?'0 4px 14px rgba(30,41,59,.25)':'none'}}>
              ส่งคำตอบ ({Object.keys(answers).length}/{questions.length})
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {screen==='result'&&latest&&(
          <div className="fu">
            <div style={{background:'#fff',borderRadius:18,padding:'22px 18px',marginBottom:14,textAlign:'center',border:'1px solid #e2e8f0'}}>
              <div style={{fontSize:44,marginBottom:6}}>{latest.pct>=80?'🏆':latest.pct>=60?'👍':'💪'}</div>
              <div style={{fontSize:36,fontWeight:700,color:latest.pct>=70?C.green:C.red,marginBottom:4}}>{latest.pct}%</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:14}}>{latest.score}/{latest.total} ข้อ · {latest.school} · {SUBJ_ICON[latest.subject]} {latest.subject}</div>
              <div style={{height:7,background:'#f3f4f6',borderRadius:4,overflow:'hidden',marginBottom:14}}>
                <div style={{height:'100%',width:`${latest.pct}%`,background:latest.pct>=70?C.green:C.red,borderRadius:4,transition:'width 1s ease'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {[{l:'ถูก',v:`${latest.score}`,c:C.green},{l:'ผิด',v:`${latest.total-latest.score}`,c:C.red},{l:'เวลา',v:fmtSec(latest.timeUsed),c:C.blue}].map(s=>(
                  <div key={s.l} style={{background:'#f9fafb',borderRadius:10,padding:'9px 6px'}}>
                    <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>เฉลยละเอียด</div>
            {questions.map(q=>{
              const ua=answers[q.id]; const ok=ua===q.ans
              const opts=q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']
              return (
                <div key={q.id} style={{background:'#fff',borderRadius:13,padding:'13px 14px',marginBottom:9,border:`2px solid ${ok?'#bbf7d0':'#fecaca'}`}}>
                  <div style={{display:'flex',gap:7,marginBottom:8}}>
                    <div style={{width:22,height:22,borderRadius:6,background:ok?C.greenL:C.redL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{ok?'✓':'✗'}</div>
                    <div style={{fontSize:13,fontWeight:500,color:C.text,lineHeight:1.55}}>{q.text}</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:9}}>
                    {opts.map((opt,oi)=>{
                      const isAns=oi===q.ans; const isUser=oi===ua
                      return <div key={oi} style={{padding:'7px 9px',borderRadius:8,border:`1.5px solid ${isAns?C.green:isUser&&!ok?C.red:'#e2e8f0'}`,background:isAns?C.greenL:isUser&&!ok?C.redL:'#fafafa',fontSize:12,color:isAns?C.greenD:isUser&&!ok?'#991b1b':C.muted,fontWeight:isAns?600:400}}>
                        {opt}{isAns?' ✓':''}{isUser&&!ok?' ✗':''}
                      </div>
                    })}
                  </div>
                  {q.explain&&<div style={{background:'#f9fafb',borderRadius:8,padding:'8px 10px',fontSize:12,color:C.text,lineHeight:1.6}}>💡 {q.explain}</div>}
                </div>
              )
            })}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:14}}>
              <button onClick={()=>setScreen('pick')} style={{padding:13,borderRadius:12,border:`2px solid ${C.navy}`,background:'transparent',color:C.navy,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>ทำใหม่</button>
              <button onClick={()=>setScreen('home')} style={{padding:13,borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>หน้าหลัก</button>
            </div>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {screen==='progress'&&(
          <div className="fu">
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>ประวัติผลสอบ</div>
            </div>
            {!history.length?(
              <div style={{textAlign:'center',padding:'48px 20px',color:C.muted}}>
                <div style={{fontSize:40,marginBottom:10}}>📝</div>
                <div style={{fontSize:14}}>ยังไม่มีประวัติ</div>
                <button onClick={()=>setScreen('pick')} style={{marginTop:14,padding:'10px 24px',borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>เริ่มทำข้อสอบ</button>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:9}}>
                {history.map(r=>(
                  <div key={r.id} style={{background:'#fff',borderRadius:14,padding:'13px 14px',border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:11}}>
                    <div style={{width:42,height:42,borderRadius:11,background:C.blueL,border:`2px solid ${C.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blue,flexShrink:0}}>{r.school.slice(0,2)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.school}</div>
                      <div style={{fontSize:11,color:C.muted}}>{SUBJ_ICON[r.subject]} {r.subject} · {r.year} · {r.createdAt}</div>
                      <div style={{height:3,background:'#f3f4f6',borderRadius:2,marginTop:5,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${r.pct}%`,background:r.pct>=70?C.green:C.red,borderRadius:2}}/>
                      </div>
                    </div>
                    <div style={{fontSize:19,fontWeight:700,color:r.pct>=70?C.green:C.red,flexShrink:0}}>{r.pct}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS (parent only) ── */}
        {screen==='settings'&&mode==='parent'&&(
          <div className="fu">
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>การตั้งค่า</div>
            </div>
            {/* child info */}
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'14px',marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>ข้อมูลนักเรียน</div>
              {cfg&&(
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                    {cfg.childAvatarUrl?<img src={cfg.childAvatarUrl} alt="" style={{width:52,height:52,borderRadius:12,objectFit:'cover'}}/>:<div style={{width:52,height:52,borderRadius:12,background:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>🧒</div>}
                    <div><div style={{fontSize:15,fontWeight:600,color:C.text}}>{cfg.childName}</div><div style={{fontSize:12,color:C.muted}}>เป้าหมาย: {cfg.childTargetSchool}</div></div>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:4}}>แก้ไขชื่อ/รูปได้ที่ <a href="/admin-tc2024" target="_blank" style={{color:C.blue}}>Admin Page →</a></div>
                </div>
              )}
            </div>
            {/* plan status */}
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'14px',marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:10}}>สถานะแผน</div>
              {isFull?(
                <div>
                  <div style={{background:C.goldL,border:'1px solid #fcd34d',borderRadius:10,padding:'10px 12px',marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#78350f'}}>⭐ Full Version</div>
                    <div style={{fontSize:12,color:'#92400e'}}>เหลือ {daysLeft} วัน</div>
                  </div>
                  <button onClick={()=>{setPlan('trial');setFullExpiry(null)}} style={{width:'100%',padding:'9px',borderRadius:10,border:'1px solid #e2e8f0',background:'transparent',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                    กลับไปโหมดทดลอง
                  </button>
                </div>
              ):(
                <div>
                  <div style={{background:'#f1f5f9',borderRadius:10,padding:'10px 12px',marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.text}}>ทดลองใช้</div>
                    <div style={{fontSize:12,color:C.muted}}>ข้อสอบ {examCount}/{TRIAL_EXAM_LIMIT} ชุดวันนี้</div>
                  </div>
                  <button onClick={()=>setShowCompare(true)} style={{width:'100%',padding:'9px',borderRadius:10,border:'none',background:C.gold,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                    ⭐ อัพเกรด Full Version
                  </button>
                </div>
              )}
            </div>
            {/* Backup */}
            <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:'14px',marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Backup ข้อมูล</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:10}}>บันทึกผลสอบและข้อมูลทั้งหมดไปยัง Google Sheets</div>
              {backupLog&&(
                <div style={{background:'#f8fafc',borderRadius:9,padding:'8px 10px',marginBottom:10,fontSize:12,color:C.muted}}>
                  Backup ล่าสุด: {new Date(backupLog.last_backup).toLocaleString('th-TH')} · {backupLog.rows_results} ผลสอบ
                </div>
              )}
              <button onClick={doBackup} disabled={backupBusy} style={{width:'100%',padding:'10px',borderRadius:10,border:'none',background:backupBusy?'#94a3b8':C.green,color:'#fff',fontSize:13,fontWeight:600,cursor:backupBusy?'default':'pointer',fontFamily:'inherit'}}>
                {backupBusy?<><span className="spin">⟳</span> กำลัง Backup...</>:'💾 Backup ไป Google Sheets'}
              </button>
              {backupMsg&&<div style={{fontSize:12,color:backupMsg.includes('สำเร็จ')?C.green:C.red,marginTop:6,textAlign:'center'}}>{backupMsg}</div>}
            </div>
          </div>
        )}

        {/* ── UPGRADE ── */}
        {screen==='upgrade'&&(
          <div className="fu">
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>⭐ Full Version</div>
            </div>
            <div style={{background:C.goldL,border:`1px solid #fcd34d`,borderRadius:14,padding:'20px',textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:28,fontWeight:700,color:'#92400e',marginBottom:2}}>{cfg?.fullVersionPrice||'299'} บาท</div>
              <div style={{fontSize:13,color:'#b45309'}}>ใช้งานได้ {cfg?.fullVersionDays||30} วัน · ไม่ต่ออัตโนมัติ</div>
            </div>
            <button onClick={()=>setShowCompare(true)} style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid #e2e8f0',background:'#fff',color:C.text,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}>
              เปรียบเทียบ ทดลอง vs Full →
            </button>
            <button onClick={()=>setShowPayment(true)} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:10}}>
              💳 ชำระเงิน / แนบสลิป
            </button>
            <button onClick={()=>setShowPin(true)} style={{width:'100%',padding:'12px',borderRadius:12,border:'1px solid #e2e8f0',background:'transparent',color:C.text,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>
              🔑 มีรหัส Full Version แล้ว — ใส่รหัส
            </button>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      {screen!=='exam'&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:'1px solid #e2e8f0',display:'flex',justifyContent:'space-around',padding:'8px 0 max(10px,env(safe-area-inset-bottom))',zIndex:50}}>
          {(mode==='student'
            ?[{id:'home',icon:'🏠',label:'หลัก'},{id:'pick',icon:'📝',label:'ข้อสอบ'},{id:'progress',icon:'📊',label:'ผล'},{id:'upgrade',icon:'⭐',label:'Full'}]
            :[{id:'home',icon:'📊',label:'Dashboard'},{id:'pick',icon:'📝',label:'ข้อสอบ'},{id:'progress',icon:'📋',label:'ประวัติ'},{id:'settings',icon:'⚙️',label:'ตั้งค่า'}]
          ).map((item:any)=>(
            <button key={item.id} onClick={()=>setScreen(item.id as Screen)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',minWidth:52,padding:'4px 6px'}}>
              <span style={{fontSize:22}}>{item.icon}</span>
              <span style={{fontSize:10,color:screen===item.id?C.green:C.muted,fontWeight:screen===item.id?700:400}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
