'use client'
// ═══════════════════════════════════════════════════════════════
//  TiwChalet v2.2.0
//  - Parent: refresh questions, school picker, profile edit
//  - LINE OA add button
//  - Responsive dashboard (phone/tablet/laptop)
//  - Backup fix, font size 4 levels
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Subject } from '@/types'

const VERSION = 'v2.2'
type Mode   = 'student' | 'parent'
type Screen = 'home'|'pick'|'exam'|'result'|'progress'|'upgrade'|'settings'|'compare'
type Plan   = 'trial' | 'full'
type PinFor = 'parent' | 'full'

interface Question { id:string; text:string; opts?:string[]; opt_a?:string; opt_b?:string; opt_c?:string; opt_d?:string; ans:number; explain:string; subject:string; school:string; year:string; level:string }
interface ExamResult { id:string; school:string; subject:string; year:string; score:number; total:number; pct:number; timeUsed:number; plan:Plan; createdAt:string }
interface AppCfg { childName:string; childAvatarUrl:string; childTargetSchool:string; qrCodeImageUrl:string; adminPhone:string; adminEmail:string; adminLineId:string; fullVersionPrice:string; fullVersionDays:number }
interface BackupLog { last_backup:string; rows_results:number; gas_ok:boolean }

const ALL_SCHOOLS  = ['สวนกุหลาบ','สามเสน','สาธิตจุฬา','สาธิตประสานมิตร','บดินทรเดชา','หอวัง']
const SUBJECTS: Subject[] = ['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English']
const SUBJ_ICON: Record<string,string> = {'คณิตศาสตร์':'➗','วิทยาศาสตร์':'🔬','ภาษาไทย':'📖','English':'🇬🇧'}
const TRIAL_SCHOOL_LIMIT  = 2
const TRIAL_EXAM_LIMIT    = 10
const TRIAL_REFRESH_LIMIT = 1   // ดึงข้อสอบใหม่ได้ 1 ครั้ง
const FONT_SIZES = [13,15,17,19] as const
const C = {
  green:'#16a34a',greenL:'#dcfce7',greenD:'#14532d',
  navy:'#1e293b', gold:'#d97706',goldL:'#fef3c7',goldD:'#78350f',
  red:'#dc2626',redL:'#fee2e2', blue:'#1d4ed8',blueL:'#eff6ff',
  purple:'#7c3aed',purpleL:'#ede9fe',
  border:'#e2e8f0', muted:'#64748b', text:'#0f172a', bg:'#f8fafc',
}

const fmtSec = (s:number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const nowStr = () => new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'})
const persist = {
  load: ()=>{ try{const d=localStorage.getItem('tc-v2');return d?JSON.parse(d):{}}catch{return{}} },
  save: (d:any)=>{ try{localStorage.setItem('tc-v2',JSON.stringify(d))}catch{} }
}

// ─── PIN MODAL ──────────────────────────────────────────────────
function PinModal({pinFor,onSuccess,onCancel}:{pinFor:PinFor;onSuccess:(t:string,d?:any)=>void;onCancel:()=>void}) {
  const [pin,setPin]=useState(''); const [busy,setBusy]=useState(false)
  const [err,setErr]=useState(''); const [shake,setShake]=useState(false)
  const cid=useRef(Math.random().toString(36).slice(2))

  const doVerify=async(p:string)=>{
    if(busy) return; setBusy(true); setErr('')
    try {
      const res=await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({pin:p,type:pinFor,clientId:cid.current})})
      const data=await res.json()
      if(data.ok){onSuccess(data.token,{...data,_rawPin:p})}
      else{setShake(true);setErr(data.error||'PIN ไม่ถูกต้อง');setPin('');setTimeout(()=>setShake(false),400)}
    }catch{setErr('เชื่อมต่อไม่ได้');setPin('')}
    finally{setBusy(false)}
  }
  const tap=async(d:string)=>{
    if(busy||pinFor!=='parent') return
    const next=d==='⌫'?pin.slice(0,-1):pin+d
    if(next.length>4) return
    setPin(next); setErr('')
    if(next.length===4) await doVerify(next)
  }
  const isParent=pinFor==='parent'
  const maxLen=isParent?4:6

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,padding:'28px 22px',width:'100%',maxWidth:300,textAlign:'center',animation:shake?'shake .35s ease':undefined}}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
        <div style={{fontSize:17,fontWeight:700,marginBottom:8,color:C.text}}>{isParent?'🔒 โหมดผู้ปกครอง':'⭐ ปลดล็อก Full Version'}</div>
        <div style={{fontSize:13,color:err?C.red:C.muted,marginBottom:16,minHeight:18}}>{err||(isParent?'ใส่รหัส 4 หลัก':'ใส่รหัส 6 หลักตัวเลข')}</div>
        {!isParent?(
          <>
            <div style={{display:'flex',justifyContent:'center',gap:10,marginBottom:20}}>
              {[0,1,2,3,4,5].map(i=><div key={i} style={{width:12,height:12,borderRadius:'50%',background:i<pin.length?C.gold:'#e2e8f0',transition:'background .12s'}}/>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i)=>d===''?<div key={i}/>:
                <button key={i} onClick={()=>{if(busy)return;const n=d==='⌫'?pin.slice(0,-1):pin+d;if(n.length>6)return;setPin(n);setErr('');if(n.length===6)doVerify(n)}} disabled={busy}
                  style={{height:52,borderRadius:12,border:`1px solid ${C.border}`,background:'#fafafa',fontSize:d==='⌫'?16:19,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:C.text}}>{d}</button>
              )}
            </div>
          </>
        ):(
          <>
            <div style={{display:'flex',justifyContent:'center',gap:14,marginBottom:20}}>
              {[0,1,2,3].map(i=><div key={i} style={{width:13,height:13,borderRadius:'50%',background:i<pin.length?C.navy:'#e2e8f0',transition:'background .12s'}}/>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i)=>d===''?<div key={i}/>:
                <button key={i} onClick={()=>tap(d)} disabled={busy}
                  style={{height:52,borderRadius:12,border:`1px solid ${C.border}`,background:'#fafafa',fontSize:d==='⌫'?16:19,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:C.text}}>{d}</button>
              )}
            </div>
          </>
        )}
        <button onClick={onCancel} style={{background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>ยกเลิก</button>
      </div>
    </div>
  )
}

// ─── PAYMENT MODAL ──────────────────────────────────────────────
function PaymentModal({cfg,onClose}:{cfg:AppCfg|null;onClose:()=>void}) {
  const [step,setStep]=useState<'info'|'slip'|'done'>('info')
  const [name,setName]=useState(''); const [contact,setContact]=useState('')
  const [note,setNote]=useState(''); const [amount,setAmount]=useState('')
  const [slipB64,setSlipB64]=useState(''); const [slipMime,setSlipMime]=useState('')
  const [slipPreview,setSlipPreview]=useState(''); const [sending,setSending]=useState(false)
  const [reqId,setReqId]=useState(''); const fileRef=useRef<HTMLInputElement>(null)
  const onSlip=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f) return
    const r=new FileReader(); r.onload=ev=>{const u=ev.target?.result as string;setSlipPreview(u);setSlipMime(f.type);setSlipB64(u.split(',')[1])}; r.readAsDataURL(f)
  }
  const submit=async()=>{
    if(!name.trim()||!slipB64){alert('กรุณากรอกชื่อและแนบสลิป');return}
    setSending(true)
    try{const res=await fetch('/api/upload-slip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:slipB64,mimeType:slipMime,name,contact,note,amount})});const data=await res.json();if(data.ok){setReqId(data.requestId);setStep('done')}else alert(data.error||'เกิดข้อผิดพลาด')}
    catch{alert('เชื่อมต่อไม่ได้')}finally{setSending(false)}
  }
  const IS={style:{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontFamily:'inherit',fontSize:14,color:C.text,outline:'none',marginBottom:10} as React.CSSProperties}
  const price=cfg?.fullVersionPrice||'299'; const days=cfg?.fullVersionDays||30
  const lineId=cfg?.adminLineId||'Oady'; const phone=cfg?.adminPhone||'-'
  const email=cfg?.adminEmail||'thitiphankk@gmail.com'; const qr=cfg?.qrCodeImageUrl||''

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:600,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'28px 20px 32px',width:'100%',maxWidth:480,maxHeight:'95dvh',overflowY:'auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
          <div style={{fontSize:18,fontWeight:700,color:C.text}}>⭐ Full Version</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:C.muted}}>×</button>
        </div>
        {step==='info'&&(<div>
          <div style={{background:C.goldL,border:'1px solid #fcd34d',borderRadius:12,padding:'14px',textAlign:'center',marginBottom:16}}>
            <div style={{fontSize:26,fontWeight:700,color:C.goldD}}>{price} บาท / {days} วัน</div>
          </div>
          {['ข้อสอบทุกโรงเรียน ไม่จำกัด','ทุก 4 วิชา','Dashboard วิเคราะห์ผล','Backup Google Sheets'].map(b=>(
            <div key={b} style={{display:'flex',gap:8,marginBottom:6,fontSize:13,color:C.greenD}}><span style={{color:C.green,fontWeight:700}}>✓</span>{b}</div>
          ))}
          {qr&&<div style={{textAlign:'center',margin:'16px 0 8px'}}><img src={qr} alt="QR" style={{width:160,height:160,borderRadius:12,border:`1px solid ${C.border}`,objectFit:'contain'}}/></div>}
          <div style={{background:C.blueL,borderRadius:10,padding:'12px',marginBottom:16,fontSize:13,color:C.blue}}>📱 LINE: @{lineId} · 📞 {phone}<br/>📧 {email}</div>
          <button onClick={()=>setStep('slip')} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>แนบสลิปชำระเงิน →</button>
        </div>)}
        {step==='slip'&&(<div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อ-นามสกุล *" {...IS}/>
          <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="LINE ID หรือเบอร์โทร" {...IS}/>
          <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`จำนวนเงิน (${price} บาท)`} type="number" {...IS}/>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="หมายเหตุ" rows={2} {...IS as any}/>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={onSlip}/>
          <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'12px',borderRadius:10,border:`2px dashed #cbd5e1`,background:'#fafafa',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:C.muted,marginBottom:slipPreview?8:16}}>
            📎 {slipPreview?'เปลี่ยนสลิป':'เลือกรูปสลิป *'}
          </button>
          {slipPreview&&<img src={slipPreview} alt="slip" style={{width:'100%',maxHeight:200,objectFit:'contain',borderRadius:10,border:`1px solid ${C.border}`,marginBottom:12}}/>}
          <button onClick={submit} disabled={sending||!name.trim()||!slipB64} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:name.trim()&&slipB64?C.green:'#d1d5db',color:'#fff',fontSize:15,fontWeight:700,cursor:name.trim()&&slipB64?'pointer':'default',fontFamily:'inherit'}}>
            {sending?'กำลังส่ง...':'ส่งสลิปให้ Admin'}
          </button>
        </div>)}
        {step==='done'&&(<div style={{textAlign:'center',padding:'20px 0'}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8,color:C.text}}>ส่งสลิปแล้ว!</div>
          <div style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:16}}>Admin จะส่ง PIN ทาง LINE ภายใน 24 ชั่วโมง</div>
          <div style={{fontSize:12,color:C.blue,marginBottom:20}}>Ref: {reqId}</div>
          <button onClick={onClose} style={{padding:'10px 28px',borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>ปิด</button>
        </div>)}
      </div>
    </div>
  )
}

// ─── COMPARE MODAL ──────────────────────────────────────────────
function CompareModal({onClose,onPay}:{onClose:()=>void;onPay:()=>void}) {
  const rows=[
    {f:'โรงเรียนที่เลือกได้',t:`${TRIAL_SCHOOL_LIMIT} โรงแรก`,u:'ทุก 6 โรงเรียน'},
    {f:'ข้อสอบต่อครั้ง',t:`${TRIAL_EXAM_LIMIT} ข้อ`,u:'ไม่จำกัด'},
    {f:'ดึงข้อสอบใหม่',t:`${TRIAL_REFRESH_LIMIT} ครั้ง`,u:'ไม่จำกัด'},
    {f:'Dashboard ผู้ปกครอง',t:'จำกัด',u:'เต็มรูปแบบ'},
    {f:'Backup Google Sheets',t:'✗',u:'✓'},
  ]
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:400,maxHeight:'92dvh',overflowY:'auto',padding:'22px 18px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700,color:C.text}}>ทดลอง vs Full Version</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.muted}}>×</button>
        </div>
        <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',marginBottom:18}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr'}}>
            {['ฟีเจอร์','ทดลอง','Full ⭐'].map((h,i)=>(
              <div key={i} style={{padding:'8px 10px',fontSize:12,fontWeight:700,color:i===2?C.goldD:C.muted,background:i===2?C.goldL:'#f8fafc',textAlign:i>0?'center':'left'}}>{h}</div>
            ))}
          </div>
          {rows.map((r,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderTop:`1px solid #f1f5f9`}}>
              <div style={{padding:'7px 10px',fontSize:12,color:C.text}}>{r.f}</div>
              <div style={{padding:'7px 10px',fontSize:12,color:r.t==='✗'?C.red:C.muted,textAlign:'center'}}>{r.t}</div>
              <div style={{padding:'7px 10px',fontSize:12,fontWeight:500,textAlign:'center',background:C.goldL,color:r.u==='✓'?C.green:r.u==='✗'?C.red:C.goldD}}>{r.u}</div>
            </div>
          ))}
        </div>
        <button onClick={onPay} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>สมัคร Full Version →</button>
        <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:12,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>ใช้ต่อแบบทดลอง</button>
      </div>
    </div>
  )
}

// ─── MAIN ───────────────────────────────────────────────────────
export default function Home() {
  const [mode,setMode]=useState<Mode>('student')
  const [plan,setPlan]=useState<Plan>('trial')
  const [screen,setScreen]=useState<Screen>('home')
  const [cfg,setCfg]=useState<AppCfg|null>(null)
  const [backupLog,setBackupLog]=useState<BackupLog|null>(null)
  const [fontSize,setFontSize]=useState<number>(15)

  const [pinFor,setPinFor]=useState<PinFor>('parent')
  const [showPin,setShowPin]=useState(false)
  const [showPayment,setShowPayment]=useState(false)
  const [showCompare,setShowCompare]=useState(false)

  const [fullExpiry,setFullExpiry]=useState<string|null>(null)
  const daysLeft=fullExpiry?Math.max(0,Math.ceil((new Date(fullExpiry).getTime()-Date.now())/86400000)):0
  const isFull=plan==='full'&&daysLeft>0

  // exam
  const [selSchool,setSelSchool]=useState('')
  const [selSubject,setSelSubject]=useState<Subject>('คณิตศาสตร์')
  const [selYear,setSelYear]=useState('2566')
  const [questions,setQuestions]=useState<Question[]>([])
  const [answers,setAnswers]=useState<Record<string,number>>({})
  const [loading,setLoading]=useState(false)
  const [loadErr,setLoadErr]=useState('')
  const [timeLeft,setTimeLeft]=useState(0)
  const [timerOn,setTimerOn]=useState(false)
  const [history,setHistory]=useState<ExamResult[]>([])
  const [examCount,setExamCount]=useState(0)
  const [refreshCount,setRefreshCount]=useState(0)  // ดึงข้อสอบใหม่

  // parent
  const [parentPin,setParentPin]=useState('')
  const [backupBusy,setBackupBusy]=useState(false)
  const [backupMsg,setBackupMsg]=useState('')
  const [editingProfile,setEditingProfile]=useState(false)
  const [editName,setEditName]=useState('')
  const [editAvatar,setEditAvatar]=useState('')
  const [savingProfile,setSavingProfile]=useState(false)

  // school picker (parent can add/remove schools for child)
  const [activeSchools,setActiveSchools]=useState<string[]>(ALL_SCHOOLS.slice(0,TRIAL_SCHOOL_LIMIT))
  const [showSchoolPicker,setShowSchoolPicker]=useState(false)

  // ── load persisted ──
  useEffect(()=>{
    const d=persist.load()
    if(d.plan) setPlan(d.plan)
    if(d.fullExpiry) setFullExpiry(d.fullExpiry)
    if(d.history) setHistory(d.history)
    if(d.examCount) setExamCount(d.examCount)
    if(d.refreshCount) setRefreshCount(d.refreshCount)
    if(d.pin) setParentPin(d.pin)
    if(d.fontSize) setFontSize(d.fontSize)
    if(d.activeSchools) setActiveSchools(d.activeSchools)
    fetch('/api/settings').then(r=>r.json()).then(d=>{
      if(d.settings){const s=d.settings;setCfg({childName:s.child_name,childAvatarUrl:s.child_avatar_url,childTargetSchool:s.child_target_school,qrCodeImageUrl:s.qr_code_image_url,adminPhone:s.admin_phone,adminEmail:s.admin_email,adminLineId:s.admin_line_id,fullVersionPrice:s.full_version_price,fullVersionDays:s.full_version_days||30});setEditName(s.child_name||'');setEditAvatar(s.child_avatar_url||'')}
    }).catch(()=>{})
  },[])

  useEffect(()=>{
    persist.save({plan,fullExpiry,history,examCount,refreshCount,pin:parentPin,fontSize,activeSchools})
  },[plan,fullExpiry,history,examCount,refreshCount,parentPin,fontSize,activeSchools])

  useEffect(()=>{if(plan==='full'&&fullExpiry&&new Date(fullExpiry)<new Date()){setPlan('trial');setFullExpiry(null)}},[plan,fullExpiry])
  useEffect(()=>{
    if(!timerOn||timeLeft<=0) return
    const t=setInterval(()=>setTimeLeft(p=>{if(p<=1){clearInterval(t);doSubmit();return 0}return p-1}),1000)
    return ()=>clearInterval(t)
  },[timerOn,timeLeft])

  // schools available — full gets all, trial gets activeSchools (max 2)
  const availableSchools=isFull?activeSchools:activeSchools.slice(0,TRIAL_SCHOOL_LIMIT)
  const canRefresh=isFull||(refreshCount<TRIAL_REFRESH_LIMIT)
  const canExam=true // ไม่จำกัดจำนวนครั้ง แต่จำกัดข้อ

  const openPinFor=(pf:PinFor)=>{setPinFor(pf);setShowPin(true)}
  const unlockParent=(_tok:string,data?:any)=>{
    setMode('parent');setShowPin(false)
    // เก็บ PIN จริง (4 หลัก) ไว้ส่ง x-admin-pin header — ไม่ใช่ token UUID
    if(data?._rawPin) setParentPin(data._rawPin)
    if(data?.settings){const s=data.settings;setCfg(p=>p?{...p,childName:s.childName||p.childName,childAvatarUrl:s.childAvatarUrl||p.childAvatarUrl,childTargetSchool:s.childTargetSchool||p.childTargetSchool,qrCodeImageUrl:s.qrCodeImageUrl||p.qrCodeImageUrl,adminPhone:s.adminPhone||p.adminPhone,adminEmail:s.adminEmail||p.adminEmail,adminLineId:s.adminLineId||p.adminLineId,fullVersionPrice:s.fullVersionPrice||p.fullVersionPrice}:null);setEditName(s.childName||'');setEditAvatar(s.childAvatarUrl||'')}
    // load backup log
    if(data?._rawPin){
      fetch('/api/backup',{headers:{'x-admin-pin':data._rawPin}}).then(r=>r.json()).then(d=>{if(d.log)setBackupLog(d.log)}).catch(()=>{})
    }
  }
  const lockParent=()=>{setMode('student');setParentPin('')}
  const unlockFull=(_tok:string,data?:any)=>{
    const days=data?.fullVersionDays||30
    const exp=new Date();exp.setDate(exp.getDate()+days)
    setPlan('full');setFullExpiry(exp.toISOString());setShowPin(false)
    setActiveSchools(ALL_SCHOOLS) // full version เปิดทุกโรงเรียน
    alert(`✅ ปลดล็อก Full Version! ใช้ได้ ${days} วัน`)
  }

  const loadExam=async()=>{
    if(!selSchool||!selSubject){setLoadErr('เลือกโรงเรียนและวิชา');return}
    setLoading(true);setLoadErr('');setQuestions([]);setAnswers({})
    try{
      const p=new URLSearchParams({school:selSchool,subject:selSubject,year:selYear})
      const res=await fetch(`/api/questions?${p}`)
      const data=await res.json()
      if(!data.ok||!data.questions?.length) throw new Error(data.error||'ไม่พบข้อสอบ')
      const qs=data.questions.map((q:Question)=>({...q,opts:q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']}))
      setQuestions(qs);setTimeLeft(qs.length*90);setTimerOn(true);setExamCount(p2=>p2+1);setScreen('exam')
    }catch(e:any){setLoadErr(e.message)}
    finally{setLoading(false)}
  }

  // ← ดึงข้อสอบใหม่จาก server
  const refreshQuestions=async()=>{
    if(!canRefresh){setShowCompare(true);return}
    setLoading(true);setLoadErr('')
    try{
      const p=new URLSearchParams({subject:selSubject,year:selYear,_r:Date.now().toString()})
      if(selSchool) p.set('school',selSchool)
      const res=await fetch(`/api/questions?${p}`)
      const data=await res.json()
      if(data.ok&&data.questions?.length){
        setRefreshCount(c=>c+1)
        alert(`✅ ดึงข้อสอบใหม่ ${data.questions.length} ข้อแล้ว! กดเริ่มทำข้อสอบได้เลย`)
      } else {
        alert(data.error||'ไม่พบข้อสอบใหม่')
      }
    }catch(e:any){alert('เชื่อมต่อไม่ได้: '+e.message)}
    finally{setLoading(false)}
  }

  const doSubmit=useCallback(()=>{
    if(!questions.length||!selSchool||!selSubject) return
    setTimerOn(false)
    const sc=questions.filter(q=>answers[q.id]===q.ans).length
    const tu=questions.length*90-timeLeft
    const r:ExamResult={id:Date.now().toString(),school:selSchool,subject:selSubject,year:selYear,score:sc,total:questions.length,pct:Math.round(sc/questions.length*100),timeUsed:tu,plan,createdAt:nowStr()}
    setHistory(p=>[r,...p].slice(0,50));setScreen('result')
    fetch('/api/save-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selSchool,subject:selSubject,year:selYear,score:sc,total:questions.length,timeUsed:tu,plan})}).catch(()=>{})
  },[questions,selSchool,selSubject,selYear,answers,timeLeft,plan])

  // ← Backup — ใช้ parentPin (4 หลัก) ตรงๆ
  const doBackup=async()=>{
    if(!parentPin){alert('กรุณาเข้าโหมดผู้ปกครองก่อน');return}
    setBackupBusy(true);setBackupMsg('กำลัง backup...')
    try{
      const res=await fetch('/api/backup',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-admin-pin':parentPin},
        body:JSON.stringify({})
      })
      const data=await res.json()
      if(data.ok){
        setBackupMsg('✅ '+data.message)
        const lr=await fetch('/api/backup',{headers:{'x-admin-pin':parentPin}})
        const ld=await lr.json()
        if(ld.log) setBackupLog(ld.log)
      } else {
        setBackupMsg('❌ '+(data.error||'เกิดข้อผิดพลาด'))
      }
    }catch(e:any){setBackupMsg('❌ '+e.message)}
    finally{setBackupBusy(false);setTimeout(()=>setBackupMsg(''),8000)}
  }

  const saveProfile=async()=>{
    if(!parentPin){alert('กรุณาเข้าโหมดผู้ปกครองก่อน');return}
    setSavingProfile(true)
    try{
      const res=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':parentPin},body:JSON.stringify({child_name:editName,child_avatar_url:editAvatar})})
      const data=await res.json()
      if(data.ok){setCfg(p=>p?{...p,childName:editName,childAvatarUrl:editAvatar}:p);setEditingProfile(false)}
      else alert('เกิดข้อผิดพลาด: '+data.error)
    }catch{alert('เชื่อมต่อไม่ได้')}
    finally{setSavingProfile(false)}
  }

  const toggleSchool=(sch:string)=>{
    setActiveSchools(p=>p.includes(sch)?p.filter(s=>s!==sch):[...p,sch])
  }

  const latest=history[0]
  const avgPct=history.length?Math.round(history.reduce((a,r)=>a+r.pct,0)/history.length):0
  const childName=cfg?.childName||'น้องมิ้น'
  const childAvatar=cfg?.childAvatarUrl||''
  const adminLineId=cfg?.adminLineId||'Oady'
  const fs=fontSize

  // ── LINE OA URL ──
  const lineOAUrl=`https://line.me/ti/p/~${adminLineId}`

  return (
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column',fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",fontSize:fs}}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        button:active{transform:scale(.97)}
        input:focus,select:focus,textarea:focus{border-color:#16a34a!important;outline:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .25s ease both}
        .spin{animation:spin .8s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        /* Responsive grid */
        .dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(min-width:640px){.dash-grid{grid-template-columns:repeat(3,1fr)}}
        @media(min-width:900px){.dash-grid{grid-template-columns:repeat(4,1fr)}}
        .content-wrap{max-width:480px;margin:0 auto;padding:14px 14px 80px;width:100%}
        @media(min-width:900px){.content-wrap{max-width:900px}}
        .two-col{display:grid;grid-template-columns:1fr}
        @media(min-width:900px){.two-col{grid-template-columns:1fr 1fr;gap:20px;align-items:start}}
      `}</style>

      {/* MODALS */}
      {showPin&&<PinModal pinFor={pinFor} onSuccess={pinFor==='full'?unlockFull:unlockParent} onCancel={()=>setShowPin(false)}/>}
      {showPayment&&<PaymentModal cfg={cfg} onClose={()=>setShowPayment(false)}/>}
      {showCompare&&<CompareModal onClose={()=>setShowCompare(false)} onPay={()=>{setShowCompare(false);setShowPayment(true)}}/>}

      {/* School picker modal */}
      {showSchoolPicker&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:600,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'24px 20px 32px',width:'100%',maxWidth:480}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text}}>เลือกโรงเรียนที่ต้องการฝึก</div>
              <button onClick={()=>setShowSchoolPicker(false)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.muted}}>×</button>
            </div>
            {!isFull&&<div style={{background:C.goldL,border:`1px solid #fcd34d`,borderRadius:9,padding:'8px 12px',marginBottom:12,fontSize:12,color:C.goldD}}>ทดลองใช้ — เลือกได้ทั้งหมด แต่ทำได้แค่ {TRIAL_SCHOOL_LIMIT} โรงเรียนแรกที่เลือก</div>}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {ALL_SCHOOLS.map((sch,i)=>{
                const checked=activeSchools.includes(sch)
                const locked=!isFull&&i>=TRIAL_SCHOOL_LIMIT&&!activeSchools.slice(0,TRIAL_SCHOOL_LIMIT).includes(sch)
                return (
                  <div key={sch} onClick={()=>!locked&&toggleSchool(sch)}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:12,border:`2px solid ${checked?C.green:C.border}`,background:checked?C.greenL:'#fafafa',cursor:locked?'default':'pointer',opacity:locked?.5:1}}>
                    <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${checked?C.green:C.border}`,background:checked?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {checked&&<span style={{color:'#fff',fontSize:14,fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:500,color:C.text,flex:1}}>{sch}</div>
                    {locked&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:C.goldL,color:C.goldD,fontWeight:600}}>⭐Full</span>}
                  </div>
                )
              })}
            </div>
            <button onClick={()=>setShowSchoolPicker(false)} style={{width:'100%',marginTop:16,padding:'12px',borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              บันทึก ({activeSchools.length} โรงเรียน)
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      {screen!=='exam'&&(
        <div style={{background:'#fff',borderBottom:`1px solid ${C.border}`,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:9,cursor:mode==='parent'?'pointer':'default'}} onClick={()=>mode==='parent'&&setEditingProfile(true)}>
            {childAvatar
              ?<img src={childAvatar} alt="" style={{width:36,height:36,borderRadius:10,objectFit:'cover',border:`2px solid ${mode==='parent'?C.green:C.border}`}}/>
              :<div style={{width:36,height:36,borderRadius:10,background:mode==='parent'?C.greenL:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{mode==='parent'?'👩':'🧒'}</div>
            }
            <div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:fs,fontWeight:600,color:C.text}}>{mode==='parent'?'คุณแม่':childName}</span>
                {isFull?<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:C.goldL,color:C.goldD,border:`1px solid #fcd34d`,fontWeight:600}}>⭐ {daysLeft}ว.</span>
                       :<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'#f1f5f9',color:C.muted}}>ทดลอง</span>}
              </div>
              <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>ติวเข้า ม.1 · {VERSION}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:5,alignItems:'center'}}>
            {/* Font size */}
            <div style={{display:'flex',gap:1,border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
              {FONT_SIZES.map((sz,i)=>(
                <button key={sz} onClick={()=>setFontSize(sz)} style={{padding:'4px 6px',border:'none',background:fontSize===sz?C.navy:'transparent',color:fontSize===sz?'#fff':C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:9+i*2,fontWeight:500}}>A</button>
              ))}
            </div>
            {!isFull&&<button onClick={()=>setShowCompare(true)} style={{fontSize:11,padding:'5px 8px',borderRadius:8,border:`1px solid #fcd34d`,background:C.goldL,color:C.goldD,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>⭐</button>}
            <button onClick={()=>mode==='parent'?lockParent():openPinFor('parent')}
              style={{fontSize:11,padding:'5px 10px',borderRadius:8,border:`1px solid ${mode==='parent'?'#86efac':C.border}`,background:mode==='parent'?C.greenL:'#f8fafc',color:mode==='parent'?C.greenD:C.muted,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
              {mode==='parent'?'🔓 ออก':'🔒 ผู้ปกครอง'}
            </button>
          </div>
        </div>
      )}

      {screen!=='exam'&&!isFull&&(
        <div style={{background:C.goldL,borderBottom:`1px solid #fde68a`,padding:'6px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:Math.max(11,fs-3),color:'#92400e'}}>ทดลองใช้ · {TRIAL_SCHOOL_LIMIT} โรงเรียน · {TRIAL_EXAM_LIMIT} ข้อ/ชุด</span>
          <button onClick={()=>setShowCompare(true)} style={{fontSize:11,padding:'3px 9px',borderRadius:6,border:'none',background:C.gold,color:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>เปรียบเทียบ</button>
        </div>
      )}
      {screen!=='exam'&&mode==='parent'&&(
        <div style={{background:'#f0fdf4',borderBottom:`1px solid #bbf7d0`,padding:'5px 14px',fontSize:Math.max(11,fs-3),color:C.greenD}}>
          🔓 โหมดผู้ปกครอง {mode==='parent'&&<span style={{opacity:.6}}>· กดรูปเพื่อแก้ข้อมูลนักเรียน</span>}
        </div>
      )}

      <div className="content-wrap" style={{flex:1}}>

        {/* HOME */}
        {screen==='home'&&(<div className="fu">

          {/* STUDENT HOME */}
          {mode==='student'&&(<div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:fs+6,fontWeight:700,color:C.text,marginBottom:2}}>สวัสดี {childName} 👋</div>
              <div style={{fontSize:fs-1,color:C.muted}}>วันนี้จะฝึกทำข้อสอบอะไร?</div>
            </div>
            <div className="dash-grid" style={{marginBottom:14}}>
              {[{v:history.length||'—',l:'ชุดที่ทำ',c:C.blue,bg:C.blueL},{v:history.length?avgPct+'%':'—',l:'เฉลี่ย',c:C.green,bg:C.greenL},{v:isFull?daysLeft+'ว.':'∞',l:isFull?'Full เหลือ':'ทดลอง',c:C.gold,bg:C.goldL}].map(s=>(
                <div key={s.l} style={{background:s.bg,borderRadius:12,padding:'13px 10px',textAlign:'center'}}>
                  <div style={{fontSize:fs+8,fontWeight:700,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:Math.max(10,fs-3),color:s.c,opacity:.75,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setScreen('pick')} style={{width:'100%',background:C.navy,color:'#fff',border:'none',borderRadius:16,padding:'18px 16px',cursor:'pointer',fontFamily:'inherit',marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:fs+2,fontWeight:700,marginBottom:2}}>เริ่มทำข้อสอบ</div>
                <div style={{fontSize:fs-2,opacity:.65}}>{availableSchools.length} โรงเรียน · 4 วิชา</div>
              </div>
              <span style={{fontSize:30}}>📝</span>
            </button>
            {latest&&(
              <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'13px',marginBottom:10}}>
                <div style={{fontSize:Math.max(11,fs-3),color:C.muted,marginBottom:7}}>ล่าสุด</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:38,height:38,borderRadius:10,background:C.blueL,border:`2px solid ${C.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blue,flexShrink:0}}>{latest.school.slice(0,2)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:fs-1,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{latest.school}</div>
                    <div style={{fontSize:Math.max(11,fs-3),color:C.muted}}>{SUBJ_ICON[latest.subject]} {latest.subject} · {latest.createdAt}</div>
                  </div>
                  <div style={{fontSize:fs+4,fontWeight:700,color:latest.pct>=70?C.green:C.red,flexShrink:0}}>{latest.pct}%</div>
                </div>
              </div>
            )}
            {!isFull&&(<button onClick={()=>setShowCompare(true)} style={{width:'100%',padding:14,borderRadius:14,border:`2px solid #fcd34d`,background:C.goldL,color:C.goldD,fontSize:fs,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              ⭐ เปรียบเทียบ ทดลอง vs Full Version
            </button>)}
          </div>)}

          {/* PARENT HOME — DASHBOARD */}
          {mode==='parent'&&(<div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:fs+4,fontWeight:700,color:C.text,marginBottom:2}}>แดชบอร์ด 📊</div>
              <div style={{fontSize:fs-1,color:C.muted}}>{childName} · {cfg?.childTargetSchool||'ติวเข้า ม.1'}</div>
            </div>

            <div className="two-col">
              <div>
                {/* Stats grid */}
                <div className="dash-grid" style={{marginBottom:12}}>
                  {[
                    {v:history.length,l:'ชุดรวม',c:C.blue,bg:C.blueL},
                    {v:history.length?avgPct+'%':'—',l:'เฉลี่ย',c:history.length?(avgPct>=70?C.green:C.red):C.muted,bg:history.length?(avgPct>=70?C.greenL:C.redL):'#f1f5f9'},
                    {v:history.filter(r=>r.pct>=80).length||'—',l:'≥80%',c:C.green,bg:C.greenL},
                    {v:history.filter(r=>r.pct<60).length||'✓',l:'ต้องปรับ',c:history.filter(r=>r.pct<60).length?C.red:C.green,bg:history.filter(r=>r.pct<60).length?C.redL:C.greenL},
                  ].map(s=>(
                    <div key={s.l} style={{background:s.bg,borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
                      <div style={{fontSize:fs+8,fontWeight:700,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:Math.max(10,fs-4),color:s.c,opacity:.75,marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Subject bars */}
                {history.length>0&&(
                  <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
                    <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:10}}>คะแนนแต่ละวิชา</div>
                    {SUBJECTS.map(subj=>{
                      const rows=history.filter(r=>r.subject===subj)
                      if(!rows.length) return null
                      const avg=Math.round(rows.reduce((a,r)=>a+r.pct,0)/rows.length)
                      const best=Math.max(...rows.map(r=>r.pct))
                      return (<div key={subj} style={{marginBottom:10}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontSize:fs-1}}>{SUBJ_ICON[subj]}</span>
                          <span style={{fontSize:fs-1,color:C.text,flex:1}}>{subj}</span>
                          <span style={{fontSize:Math.max(10,fs-3),color:C.muted}}>best {best}%</span>
                          <span style={{fontSize:fs-1,fontWeight:700,color:avg>=70?C.green:C.red,minWidth:36,textAlign:'right'}}>{avg}%</span>
                        </div>
                        <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${avg}%`,background:avg>=70?C.green:C.red,borderRadius:4,transition:'width .5s'}}/>
                        </div>
                      </div>)
                    }).filter(Boolean)}
                  </div>
                )}
              </div>

              <div>
                {/* Quick actions */}
                <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
                  <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:10}}>เมนูลัด</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      {l:'ตั้งค่า',i:'⚙️',fn:()=>setScreen('settings')},
                      {l:'ประวัติ',i:'📋',fn:()=>setScreen('progress')},
                      {l:'ทำข้อสอบ',i:'📝',fn:()=>setScreen('pick')},
                      {l:'Full Version',i:'⭐',fn:()=>setScreen('upgrade')},
                    ].map(b=>(
                      <button key={b.l} onClick={b.fn} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 12px',borderRadius:11,border:`1px solid ${C.border}`,background:'#fafafa',color:C.text,cursor:'pointer',fontFamily:'inherit',fontSize:fs-1,fontWeight:500}}>
                        <span style={{fontSize:18}}>{b.i}</span>{b.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LINE OA button */}
                <a href={lineOAUrl} target="_blank" rel="noopener noreferrer"
                  style={{display:'flex',alignItems:'center',gap:10,padding:'13px 16px',borderRadius:14,background:'#06c755',color:'#fff',textDecoration:'none',marginBottom:12,cursor:'pointer'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 5.92 2 10.74c0 2.61 1.34 4.94 3.45 6.51L4.5 21l4.05-1.96C9.6 19.64 10.78 19.85 12 19.85c5.52 0 10-3.92 10-8.74S17.52 2 12 2z"/></svg>
                  <div>
                    <div style={{fontSize:fs,fontWeight:700}}>Add LINE OA ติวฉลาด</div>
                    <div style={{fontSize:Math.max(10,fs-3),opacity:.85}}>รับแจ้งเตือน · ติดต่อ Admin</div>
                  </div>
                  <span style={{marginLeft:'auto',fontSize:16}}>→</span>
                </a>

                {/* School picker */}
                <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{fontSize:fs,fontWeight:700,color:C.text}}>โรงเรียนที่ฝึก</div>
                    <button onClick={()=>setShowSchoolPicker(true)} style={{fontSize:12,padding:'4px 10px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.blue,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>+ เพิ่ม/ลบ</button>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {activeSchools.length>0?activeSchools.map(s=>(
                      <span key={s} style={{fontSize:12,padding:'4px 10px',borderRadius:20,background:C.blueL,color:C.blue,border:`1px solid #bfdbfe`,fontWeight:500}}>{s}</span>
                    )):<span style={{fontSize:12,color:C.muted}}>ยังไม่ได้เลือก</span>}
                  </div>
                </div>

                {/* Refresh questions */}
                <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
                  <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:4}}>ดึงข้อสอบใหม่จาก Server</div>
                  <div style={{fontSize:Math.max(11,fs-3),color:C.muted,marginBottom:10}}>
                    {isFull?'Full Version: ดึงได้ไม่จำกัด':
                      refreshCount<TRIAL_REFRESH_LIMIT?`ทดลอง: เหลือ ${TRIAL_REFRESH_LIMIT-refreshCount} ครั้ง`:'ทดลอง: ใช้ครบแล้ว'}
                  </div>
                  <button onClick={refreshQuestions} disabled={loading||(!isFull&&refreshCount>=TRIAL_REFRESH_LIMIT)}
                    style={{width:'100%',padding:'10px',borderRadius:10,border:'none',background:loading||(!isFull&&refreshCount>=TRIAL_REFRESH_LIMIT)?'#d1d5db':C.purple,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:loading||(!isFull&&refreshCount>=TRIAL_REFRESH_LIMIT)?'default':'pointer',fontFamily:'inherit'}}>
                    {loading?<><span className="spin">⟳</span> กำลังดึง...</>:'🔄 ดึงข้อสอบใหม่'}
                  </button>
                  {!isFull&&refreshCount>=TRIAL_REFRESH_LIMIT&&(
                    <button onClick={()=>setShowCompare(true)} style={{width:'100%',marginTop:6,padding:'8px',borderRadius:9,border:'none',background:C.gold,color:'#fff',fontSize:Math.max(11,fs-3),cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>⭐ อัพเกรดเพื่อดึงไม่จำกัด</button>
                  )}
                </div>
              </div>
            </div>

            {/* Recent history */}
            {history.length>0&&(
              <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div style={{fontSize:fs,fontWeight:700,color:C.text}}>ประวัติล่าสุด</div>
                  <button onClick={()=>setScreen('progress')} style={{fontSize:12,color:C.blue,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>ดูทั้งหมด →</button>
                </div>
                {history.slice(0,5).map(r=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 0',borderBottom:`1px solid #f8fafc`}}>
                    <div style={{width:32,height:32,borderRadius:9,background:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:C.blue,flexShrink:0}}>{r.school.slice(0,2)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:fs-1,fontWeight:500,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.school} · {SUBJ_ICON[r.subject]} {r.subject}</div>
                      <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>{r.createdAt}</div>
                    </div>
                    <div style={{fontSize:fs+2,fontWeight:700,color:r.pct>=70?C.green:C.red,flexShrink:0}}>{r.pct}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>)}
        </div>)}

        {/* EXAM PICK */}
        {screen==='pick'&&(<div className="fu">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div><div style={{fontSize:fs+2,fontWeight:700,color:C.text}}>เลือกข้อสอบ</div><div style={{fontSize:Math.max(11,fs-3),color:C.muted}}>4 วิชา · {availableSchools.length} โรงเรียน</div></div>
          </div>
          <div style={{display:'flex',gap:7,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
            {['2564','2565','2566','2567'].map(y=>(
              <button key={y} onClick={()=>setSelYear(y)} style={{flexShrink:0,padding:'6px 14px',borderRadius:20,border:`1.5px solid ${selYear===y?C.navy:C.border}`,background:selYear===y?C.navy:'#fff',color:selYear===y?'#fff':C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:fs-1,fontWeight:selYear===y?600:400}}>ปี {y}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
            {SUBJECTS.map(s=>(
              <button key={s} onClick={()=>setSelSubject(s)} style={{padding:'7px 14px',borderRadius:20,border:`1.5px solid ${selSubject===s?C.navy:C.border}`,background:selSubject===s?C.navy:'#fff',color:selSubject===s?'#fff':C.muted,cursor:'pointer',fontFamily:'inherit',fontSize:fs-1,fontWeight:selSubject===s?600:400}}>
                {SUBJ_ICON[s]} {s}
              </button>
            ))}
          </div>
          <div style={{fontSize:Math.max(11,fs-3),fontWeight:600,color:C.muted,marginBottom:8}}>โรงเรียน</div>
          <div style={{display:'flex',flexDirection:'column',gap:9,marginBottom:20}}>
            {availableSchools.map(sch=>{
              const sel=selSchool===sch
              return (<div key={sch} onClick={()=>setSelSchool(sch)}
                style={{background:sel?C.blueL:'#fff',border:`2px solid ${sel?C.blue:C.border}`,borderRadius:14,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <div style={{width:34,height:34,borderRadius:9,background:C.blueL,border:`2px solid ${C.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blue,flexShrink:0}}>{sch.slice(0,2)}</div>
                  <div style={{fontSize:fs-1,fontWeight:600,color:C.text}}>{sch}</div>
                </div>
                <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${sel?C.blue:C.border}`,background:sel?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{sel&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}</div>
              </div>)
            })}
            {!isFull&&ALL_SCHOOLS.slice(TRIAL_SCHOOL_LIMIT).filter(s=>!availableSchools.includes(s)).map(sch=>(
              <div key={sch} onClick={()=>setShowCompare(true)}
                style={{background:'#fafafa',border:`2px solid ${C.border}`,borderRadius:14,padding:'12px 14px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',opacity:.5}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <div style={{width:34,height:34,borderRadius:9,background:'#f1f5f9',border:`2px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.muted,flexShrink:0}}>{sch.slice(0,2)}</div>
                  <div style={{fontSize:fs-1,fontWeight:600,color:C.muted}}>{sch}</div>
                </div>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:C.goldL,color:C.goldD,border:`1px solid #fcd34d`,fontWeight:600}}>⭐Full</span>
              </div>
            ))}
          </div>
          <div style={{position:'sticky',bottom:72}}>
            <button onClick={loadExam} disabled={!selSchool||loading}
              style={{width:'100%',padding:15,borderRadius:14,border:'none',background:selSchool&&!loading?C.navy:'#d1d5db',color:'#fff',fontSize:fs,fontWeight:700,cursor:selSchool&&!loading?'pointer':'default',fontFamily:'inherit',boxShadow:selSchool?'0 4px 14px rgba(30,41,59,.25)':'none'}}>
              {loading?<><span className="spin">⟳</span> กำลังโหลด...</>:selSchool?`เริ่ม — ${selSchool}`:'เลือกโรงเรียน'}
            </button>
            {loadErr&&<div style={{fontSize:Math.max(11,fs-3),color:C.red,textAlign:'center',marginTop:6}}>{loadErr}</div>}
          </div>
        </div>)}

        {/* EXAM */}
        {screen==='exam'&&questions.length>0&&(<div className="fu">
          <div style={{background:'#fff',borderRadius:14,padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',border:`1px solid ${C.border}`}}>
            <div><div style={{fontSize:fs,fontWeight:700,color:C.text}}>{selSchool} · {SUBJ_ICON[selSubject]} {selSubject}</div><div style={{fontSize:Math.max(11,fs-3),color:C.muted}}>ตอบแล้ว {Object.keys(answers).length}/{questions.length} ข้อ</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:fs+6,fontWeight:700,color:timeLeft<60?C.red:C.green,fontVariantNumeric:'tabular-nums'}}>{fmtSec(timeLeft)}</div><div style={{fontSize:10,color:C.muted}}>เหลือเวลา</div></div>
          </div>
          <div style={{height:4,background:'#f1f5f9',borderRadius:2,marginBottom:14,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Object.keys(answers).length/questions.length*100}%`,background:C.navy,transition:'width .3s'}}/>
          </div>
          {questions.map(q=>{
            const opts=q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']
            return (<div key={q.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:10,border:`2px solid ${answers[q.id]!==undefined?C.navy:C.border}`,transition:'border-color .15s'}}>
              <div style={{display:'flex',gap:8,marginBottom:11}}>
                <div style={{width:24,height:24,borderRadius:7,background:answers[q.id]!==undefined?C.navy:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:answers[q.id]!==undefined?'#fff':C.muted,flexShrink:0}}>{q.id.toString().slice(-2)}</div>
                <div style={{fontSize:fs,fontWeight:500,color:C.text,lineHeight:1.6}}>{q.text}</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {opts.map((opt,oi)=>{const sel=answers[q.id]===oi;return <button key={oi} onClick={()=>setAnswers(p=>({...p,[q.id]:oi}))} style={{padding:'10px 12px',borderRadius:10,border:`2px solid ${sel?C.navy:C.border}`,background:sel?C.navy:'#fafafa',color:sel?'#fff':C.text,fontSize:fs-1,cursor:'pointer',fontFamily:'inherit',textAlign:'left',fontWeight:sel?600:400,transition:'all .12s'}}>{opt}</button>})}
              </div>
            </div>)
          })}
          <button onClick={doSubmit} disabled={Object.keys(answers).length<questions.length}
            style={{width:'100%',padding:15,borderRadius:14,border:'none',background:Object.keys(answers).length===questions.length?C.navy:'#d1d5db',color:'#fff',fontSize:fs,fontWeight:700,cursor:Object.keys(answers).length===questions.length?'pointer':'default',fontFamily:'inherit',marginTop:4}}>
            ส่งคำตอบ ({Object.keys(answers).length}/{questions.length})
          </button>
        </div>)}

        {/* RESULT */}
        {screen==='result'&&latest&&(<div className="fu">
          <div style={{background:'#fff',borderRadius:18,padding:'22px 18px',marginBottom:14,textAlign:'center',border:`1px solid ${C.border}`}}>
            <div style={{fontSize:44,marginBottom:6}}>{latest.pct>=80?'🏆':latest.pct>=60?'👍':'💪'}</div>
            <div style={{fontSize:fs+22,fontWeight:700,color:latest.pct>=70?C.green:C.red,marginBottom:4}}>{latest.pct}%</div>
            <div style={{fontSize:fs-1,color:C.muted,marginBottom:14}}>{latest.score}/{latest.total} ข้อ · {latest.school}</div>
            <div style={{height:7,background:'#f3f4f6',borderRadius:4,overflow:'hidden',marginBottom:14}}><div style={{height:'100%',width:`${latest.pct}%`,background:latest.pct>=70?C.green:C.red,borderRadius:4,transition:'width 1s ease'}}/></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {[{l:'ถูก',v:`${latest.score}`,c:C.green},{l:'ผิด',v:`${latest.total-latest.score}`,c:C.red},{l:'เวลา',v:fmtSec(latest.timeUsed),c:C.blue}].map(s=>(
                <div key={s.l} style={{background:'#f9fafb',borderRadius:10,padding:'9px 6px'}}><div style={{fontSize:fs+4,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:Math.max(10,fs-3),color:C.muted,marginTop:1}}>{s.l}</div></div>
              ))}
            </div>
          </div>
          <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:10}}>เฉลยละเอียด</div>
          {questions.map(q=>{
            const ua=answers[q.id]; const ok=ua===q.ans
            const opts=q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']
            return (<div key={q.id} style={{background:'#fff',borderRadius:13,padding:'13px 14px',marginBottom:9,border:`2px solid ${ok?'#bbf7d0':'#fecaca'}`}}>
              <div style={{display:'flex',gap:7,marginBottom:8}}><div style={{width:22,height:22,borderRadius:6,background:ok?C.greenL:C.redL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{ok?'✓':'✗'}</div><div style={{fontSize:fs,fontWeight:500,color:C.text,lineHeight:1.55}}>{q.text}</div></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:q.explain?9:0}}>
                {opts.map((opt,oi)=>{const isAns=oi===q.ans;const isUser=oi===ua;return <div key={oi} style={{padding:'7px 9px',borderRadius:8,border:`1.5px solid ${isAns?C.green:isUser&&!ok?C.red:C.border}`,background:isAns?C.greenL:isUser&&!ok?C.redL:'#fafafa',fontSize:fs-2,color:isAns?C.greenD:isUser&&!ok?'#991b1b':C.muted,fontWeight:isAns?600:400}}>{opt}{isAns?' ✓':''}{isUser&&!ok?' ✗':''}</div>})}
              </div>
              {q.explain&&<div style={{background:'#f9fafb',borderRadius:8,padding:'8px 10px',fontSize:fs-2,color:C.text,lineHeight:1.6}}>💡 {q.explain}</div>}
            </div>)
          })}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:14}}>
            <button onClick={()=>setScreen('pick')} style={{padding:13,borderRadius:12,border:`2px solid ${C.navy}`,background:'transparent',color:C.navy,fontSize:fs,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>ทำใหม่</button>
            <button onClick={()=>setScreen('home')} style={{padding:13,borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:fs,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>หน้าหลัก</button>
          </div>
        </div>)}

        {/* PROGRESS */}
        {screen==='progress'&&(<div className="fu">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{fontSize:fs+2,fontWeight:700,color:C.text}}>ประวัติผลสอบ</div>
          </div>
          {!history.length
            ?(<div style={{textAlign:'center',padding:'48px 20px',color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>📝</div><div style={{fontSize:fs}}>ยังไม่มีประวัติ</div><button onClick={()=>setScreen('pick')} style={{marginTop:14,padding:'10px 24px',borderRadius:12,border:'none',background:C.navy,color:'#fff',fontSize:fs,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>เริ่มทำข้อสอบ</button></div>)
            :(<div style={{display:'flex',flexDirection:'column',gap:9}}>
              {history.map(r=>(
                <div key={r.id} style={{background:'#fff',borderRadius:14,padding:'13px 14px',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:11}}>
                  <div style={{width:42,height:42,borderRadius:11,background:C.blueL,border:`2px solid ${C.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.blue,flexShrink:0}}>{r.school.slice(0,2)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:fs-1,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.school}</div>
                    <div style={{fontSize:Math.max(10,fs-3),color:C.muted}}>{SUBJ_ICON[r.subject]} {r.subject} · {r.createdAt}</div>
                    <div style={{height:3,background:'#f3f4f6',borderRadius:2,marginTop:5,overflow:'hidden'}}><div style={{height:'100%',width:`${r.pct}%`,background:r.pct>=70?C.green:C.red,borderRadius:2}}/></div>
                  </div>
                  <div style={{fontSize:fs+4,fontWeight:700,color:r.pct>=70?C.green:C.red,flexShrink:0}}>{r.pct}%</div>
                </div>
              ))}
            </div>)
          }
        </div>)}

        {/* SETTINGS (parent) */}
        {screen==='settings'&&mode==='parent'&&(<div className="fu">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{fontSize:fs+2,fontWeight:700,color:C.text}}>การตั้งค่า</div>
          </div>

          {/* Profile card — ใหญ่ขึ้น น่ารัก */}
          <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:18,padding:'20px',marginBottom:12}}>
            <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:16}}>ข้อมูลนักเรียน</div>
            {!editingProfile?(
              <div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:16}}>
                  {cfg?.childAvatarUrl
                    ?<img src={cfg.childAvatarUrl} alt="" style={{width:100,height:100,borderRadius:24,objectFit:'cover',border:`3px solid ${C.green}`,marginBottom:10}}/>
                    :<div style={{width:100,height:100,borderRadius:24,background:`linear-gradient(135deg,${C.blueL},${C.greenL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,marginBottom:10,border:`3px solid ${C.green}`}}>🧒</div>
                  }
                  <div style={{fontSize:fs+4,fontWeight:700,color:C.text,marginBottom:3}}>{cfg?.childName||'น้องมิ้น'}</div>
                  <div style={{fontSize:fs-1,color:C.muted}}>เป้าหมาย: {cfg?.childTargetSchool||'ติวเข้า ม.1'}</div>
                </div>
                <button onClick={()=>{setEditingProfile(true);setEditName(cfg?.childName||'');setEditAvatar(cfg?.childAvatarUrl||'')}}
                  style={{width:'100%',padding:'11px',borderRadius:12,border:`1.5px solid ${C.border}`,background:'#fafafa',color:C.text,fontSize:fs-1,cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
                  ✏️ แก้ไขชื่อ / รูปนักเรียน
                </button>
              </div>
            ):(
              <div>
                {/* Avatar preview large */}
                <div style={{textAlign:'center',marginBottom:14}}>
                  {editAvatar
                    ?<img src={editAvatar} alt="" style={{width:100,height:100,borderRadius:24,objectFit:'cover',border:`3px solid ${C.green}`,display:'block',margin:'0 auto 8px'}}/>
                    :<div style={{width:100,height:100,borderRadius:24,background:`linear-gradient(135deg,${C.blueL},${C.greenL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,margin:'0 auto 8px',border:`3px solid ${C.green}`}}>🧒</div>
                  }
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:Math.max(11,fs-3),fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>ชื่อนักเรียน</label>
                  <input value={editName} onChange={e=>setEditName(e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:fs,color:C.text,outline:'none',fontFamily:'inherit'}}/>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:Math.max(11,fs-3),fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>URL รูปโปรไฟล์</label>
                  <input value={editAvatar} onChange={e=>setEditAvatar(e.target.value)} placeholder="https://..." style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:fs,color:C.text,outline:'none',fontFamily:'inherit'}}/>
                  <div style={{fontSize:Math.max(10,fs-4),color:C.muted,marginTop:4}}>วาง URL รูปจาก Google Photos, Cloudinary, หรือ URL รูปจากอินเทอร์เน็ต</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <button onClick={()=>setEditingProfile(false)} style={{padding:'10px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:fs-1,cursor:'pointer',fontFamily:'inherit'}}>ยกเลิก</button>
                  <button onClick={saveProfile} disabled={savingProfile} style={{padding:'10px',borderRadius:10,border:'none',background:savingProfile?'#94a3b8':C.green,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:savingProfile?'default':'pointer',fontFamily:'inherit'}}>{savingProfile?'กำลังบันทึก...':'💾 บันทึก'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Plan status */}
          <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
            <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:10}}>สถานะแผน</div>
            {isFull?(
              <div>
                <div style={{background:C.goldL,border:`1px solid #fcd34d`,borderRadius:10,padding:'10px 12px',marginBottom:10}}>
                  <div style={{fontSize:fs,fontWeight:700,color:C.goldD}}>⭐ Full Version</div>
                  <div style={{fontSize:Math.max(11,fs-3),color:'#92400e'}}>เหลือ {daysLeft} วัน</div>
                </div>
              </div>
            ):(
              <div>
                <div style={{background:'#f1f5f9',borderRadius:10,padding:'10px 12px',marginBottom:10}}>
                  <div style={{fontSize:fs,fontWeight:600,color:C.text}}>ทดลองใช้</div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <button onClick={()=>openPinFor('full')} style={{padding:'9px',borderRadius:10,border:'none',background:C.navy,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>🔑 มีรหัส</button>
                  <button onClick={()=>setShowPayment(true)} style={{padding:'9px',borderRadius:10,border:'none',background:C.gold,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>💳 ชำระเงิน</button>
                </div>
              </div>
            )}
          </div>

          {/* LINE OA */}
          <a href={lineOAUrl} target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:10,padding:'13px 16px',borderRadius:14,background:'#06c755',color:'#fff',textDecoration:'none',marginBottom:12}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 5.92 2 10.74c0 2.61 1.34 4.94 3.45 6.51L4.5 21l4.05-1.96C9.6 19.64 10.78 19.85 12 19.85c5.52 0 10-3.92 10-8.74S17.52 2 12 2z"/></svg>
            <div>
              <div style={{fontSize:fs,fontWeight:700}}>Add LINE OA ติวฉลาด</div>
              <div style={{fontSize:Math.max(10,fs-3),opacity:.85}}>รับแจ้งเตือน · ติดต่อ Admin</div>
            </div>
            <span style={{marginLeft:'auto',fontSize:16}}>→</span>
          </a>

          {/* Backup */}
          <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px'}}>
            <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:4}}>Backup ข้อมูล</div>
            <div style={{fontSize:Math.max(11,fs-3),color:C.muted,marginBottom:backupLog?6:10}}>บันทึกผลสอบไปยัง Google Sheets อัตโนมัติทุกอาทิตย์</div>
            {backupLog&&<div style={{background:'#f8fafc',borderRadius:9,padding:'7px 10px',marginBottom:10,fontSize:Math.max(11,fs-3),color:C.muted}}>
              ล่าสุด: {new Date(backupLog.last_backup).toLocaleString('th-TH')} · {backupLog.rows_results} ผลสอบ {backupLog.gas_ok?'✅':'⚠️'}
            </div>}
            <button onClick={doBackup} disabled={backupBusy}
              style={{width:'100%',padding:'10px',borderRadius:10,border:'none',background:backupBusy?'#94a3b8':C.green,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:backupBusy?'default':'pointer',fontFamily:'inherit'}}>
              {backupBusy?<><span className="spin">⟳</span> กำลัง Backup...</>:'💾 Backup ไป Google Sheets'}
            </button>
            {backupMsg&&<div style={{fontSize:Math.max(11,fs-3),color:backupMsg.startsWith('✅')?C.green:C.red,marginTop:6,textAlign:'center'}}>{backupMsg}</div>}
          </div>
        </div>)}

        {/* UPGRADE */}
        {screen==='upgrade'&&(<div className="fu">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{fontSize:fs+2,fontWeight:700,color:C.text}}>⭐ Full Version</div>
          </div>
          <div style={{background:C.goldL,border:`1px solid #fcd34d`,borderRadius:14,padding:'20px',textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:fs+12,fontWeight:700,color:C.goldD,marginBottom:2}}>{cfg?.fullVersionPrice||'299'} บาท</div>
            <div style={{fontSize:fs-1,color:'#b45309'}}>{cfg?.fullVersionDays||30} วัน · ไม่ต่ออัตโนมัติ</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            <button onClick={()=>setShowCompare(true)} style={{width:'100%',padding:'12px',borderRadius:12,border:`1px solid ${C.border}`,background:'#fff',color:C.text,fontSize:fs,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>เปรียบเทียบ ทดลอง vs Full →</button>
            <button onClick={()=>setShowPayment(true)} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:fs,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>💳 ชำระเงิน / แนบสลิป</button>
            <button onClick={()=>openPinFor('full')} style={{width:'100%',padding:'12px',borderRadius:12,border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontSize:fs,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>🔑 มีรหัส Full Version แล้ว</button>
          </div>
        </div>)}

      </div>

      {/* BOTTOM NAV */}
      {screen!=='exam'&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-around',padding:'8px 0 max(10px,env(safe-area-inset-bottom))',zIndex:50}}>
          {(mode==='student'
            ?[{id:'home',icon:'🏠',label:'หลัก'},{id:'pick',icon:'📝',label:'ข้อสอบ'},{id:'progress',icon:'📊',label:'ผล'},{id:'upgrade',icon:'⭐',label:'Full'}]
            :[{id:'home',icon:'📊',label:'Dashboard'},{id:'pick',icon:'📝',label:'ข้อสอบ'},{id:'progress',icon:'📋',label:'ประวัติ'},{id:'settings',icon:'⚙️',label:'ตั้งค่า'}]
          ).map((item:any)=>(
            <button key={item.id} onClick={()=>setScreen(item.id as Screen)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',minWidth:52,padding:'4px 6px'}}>
              <span style={{fontSize:22}}>{item.icon}</span>
              <span style={{fontSize:10,color:screen===item.id?C.green:C.muted,fontWeight:screen===item.id?700:400}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
