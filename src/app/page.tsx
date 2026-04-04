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
type Screen = 'home'|'pick'|'exam'|'result'|'progress'|'upgrade'|'settings'|'compare'|'help'
type Plan   = 'trial' | 'full'
type PinFor = 'parent' | 'full'

interface Question { id:string; text:string; opts?:string[]; opt_a?:string; opt_b?:string; opt_c?:string; opt_d?:string; ans:number; explain:string; subject:string; school:string; year:string; level:string; image_url?:string; opt_a_img?:string; opt_b_img?:string; opt_c_img?:string; opt_d_img?:string; explain_img?:string }
interface ExamResult { id:string; school:string; subject:string; year:string; score:number; total:number; pct:number; timeUsed:number; plan:Plan; createdAt:string }
interface AppCfg { childName:string; childAvatarUrl:string; childTargetSchool:string; qrCodeImageUrl:string; adminPhone:string; adminEmail:string; adminLineId:string; fullVersionPrice:string; fullVersionDays:number; parentName:string }
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
// CustomerID — สร้างครั้งเดียวต่อ device ไม่เปลี่ยน
function getCustomerId(): string {
  try {
    let id = localStorage.getItem('tc-cid')
    if (!id) { id = 'CUS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase(); localStorage.setItem('tc-cid', id) }
    return id
  } catch { return 'CUS-UNKNOWN' }
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
  const price=cfg?.fullVersionPrice||'100'; const days=cfg?.fullVersionDays||45
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
            <div style={{fontSize:22,fontWeight:700,color:C.goldD}}>☕ สนับสนุนค่ากาแฟ</div>
            <div style={{fontSize:28,fontWeight:800,color:C.goldD,marginTop:4}}>{price} <span style={{fontSize:16,fontWeight:600}}>บาท/เดือน</span></div>
            <div style={{fontSize:12,color:'#b45309',marginTop:4}}>ใช้งาน Full Version {days} วัน · ไม่ต่ออัตโนมัติ</div>
          </div>
          {['ข้อสอบทุกโรงเรียน ไม่จำกัด','ทุก 4 วิชา','Dashboard วิเคราะห์ผล','Backup Google Sheets'].map(b=>(
            <div key={b} style={{display:'flex',gap:8,marginBottom:6,fontSize:13,color:C.greenD}}><span style={{color:C.green,fontWeight:700}}>✓</span>{b}</div>
          ))}
          {qr&&<div style={{textAlign:'center',margin:'16px 0 8px'}}><img src={qr} alt="QR" style={{width:160,height:160,borderRadius:12,border:`1px solid ${C.border}`,objectFit:'contain'}}/></div>}
          <div style={{background:C.blueL,borderRadius:10,padding:'12px',marginBottom:16,fontSize:13,color:C.blue}}>📱 LINE: @{lineId} · 📞 {phone}<br/>📧 {email}</div>
          <button onClick={()=>setStep('slip')} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>☕ สนับสนุน {price} บาท/เดือน →</button>
        </div>)}
        {step==='slip'&&(<div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อ-นามสกุล *" {...IS}/>
          <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="LINE ID หรือเบอร์โทร" {...IS}/>
          <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`จำนวนที่โอน (${price} บาท)`} type="number" {...IS}/>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="หมายเหตุ" rows={2} {...IS as any}/>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={onSlip}/>
          <button onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:'12px',borderRadius:10,border:`2px dashed #cbd5e1`,background:'#fafafa',cursor:'pointer',fontFamily:'inherit',fontSize:13,color:C.muted,marginBottom:slipPreview?8:16}}>
            📎 {slipPreview?'เปลี่ยนสลิป':'เลือกรูปสลิป *'}
          </button>
          {slipPreview&&<img src={slipPreview} alt="slip" style={{width:'100%',maxHeight:200,objectFit:'contain',borderRadius:10,border:`1px solid ${C.border}`,marginBottom:12}}/>}
          <button onClick={submit} disabled={sending||!name.trim()||!slipB64} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:name.trim()&&slipB64?C.green:'#d1d5db',color:'#fff',fontSize:15,fontWeight:700,cursor:name.trim()&&slipB64?'pointer':'default',fontFamily:'inherit'}}>
            {sending?'กำลังส่ง...':'✅ ส่งหลักฐานให้แอดมิน'}
          </button>
        </div>)}
        {step==='done'&&(<div style={{textAlign:'center',padding:'20px 0'}}>
          <div style={{fontSize:48,marginBottom:12}}>✅</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8,color:C.text}}>ส่งสลิปแล้ว!</div>
          <div style={{fontSize:14,color:C.muted,lineHeight:1.7,marginBottom:16}}>แอดมินจะส่ง PIN Full Version ทาง LINE ภายใน 24 ชั่วโมง ขอบคุณที่สนับสนุน ☕</div>
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
        <button onClick={onPay} style={{width:'100%',padding:'13px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>☕ สนับสนุนค่ากาแฟ →</button>
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
  const [showCancelConfirm,setShowCancelConfirm]=useState(false)
  const [customerId,setCustomerId]=useState('CUS-LOADING')
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
  const [backupType,setBackupType]=useState<'local'|'cloud'|'sheet'|null>(null)
  const [editingProfile,setEditingProfile]=useState(false)
  const [editParentName,setEditParentName]=useState('คุณแม่')
  const [showProfileModal,setShowProfileModal]=useState(false)  // modal overlay
  const [showRestoreModal,setShowRestoreModal]=useState(false)
  const [showReportModal,setShowReportModal]=useState(false)
  const [restoreId,setRestoreId]=useState('')
  const [restoreBusy,setRestoreBusy]=useState(false)
  const [restoreMsg,setRestoreMsg]=useState('')
  const [cropMode,setCropMode]=useState(false)
  const canvasRef = typeof window !== 'undefined' ? null : null
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
    setCustomerId(getCustomerId())
    fetch('/api/settings').then(r=>r.json()).then(d=>{
      if(d.settings){const s=d.settings;setCfg({childName:s.child_name,childAvatarUrl:s.child_avatar_url,childTargetSchool:s.child_target_school,qrCodeImageUrl:s.qr_code_image_url,adminPhone:s.admin_phone,adminEmail:s.admin_email,adminLineId:s.admin_line_id,fullVersionPrice:s.full_version_price,fullVersionDays:s.full_version_days||30,parentName:s.parent_name||'คุณแม่'});setEditName(s.child_name||'');setEditAvatar(s.child_avatar_url||'');setEditParentName(s.parent_name||'คุณแม่')}
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
    // เก็บ PIN จริง (5 หลัก) ไว้ส่ง x-admin-pin header — ไม่ใช่ token UUID
    if(data?._rawPin) setParentPin(data._rawPin)
    if(data?.settings){const s=data.settings;setCfg(p=>p?{...p,childName:s.childName||p.childName,childAvatarUrl:s.childAvatarUrl||p.childAvatarUrl,childTargetSchool:s.childTargetSchool||p.childTargetSchool,qrCodeImageUrl:s.qrCodeImageUrl||p.qrCodeImageUrl,adminPhone:s.adminPhone||p.adminPhone,adminEmail:s.adminEmail||p.adminEmail,adminLineId:s.adminLineId||p.adminLineId,fullVersionPrice:s.fullVersionPrice||p.fullVersionPrice}:null);setEditName(s.childName||'');setEditAvatar(s.childAvatarUrl||'')}
    // load backup log
    if(data?._rawPin){
      fetch('/api/backup',{headers:{'x-admin-pin':data._rawPin}}).then(r=>r.json()).then(d=>{if(d.log)setBackupLog(d.log)}).catch(()=>{})
    }
  }
  const lockParent=()=>{setMode('student');setParentPin('')}
  const unlockFull=(_tok:string,data?:any)=>{
    const days=data?.fullVersionDays||45
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

  const cancelExam=()=>{
    setTimerOn(false); setShowCancelConfirm(false)
    setQuestions([]); setAnswers({}); setTimeLeft(0)
    setExamCount(c=>Math.max(0,c-1)) // คืน count กลับ
    setScreen('pick')
  }

  const doSubmit=useCallback(()=>{
    if(!questions.length||!selSchool||!selSubject) return
    setTimerOn(false)
    const sc=questions.filter(q=>answers[q.id]===q.ans).length
    const tu=questions.length*90-timeLeft
    const r:ExamResult={id:Date.now().toString(),school:selSchool,subject:selSubject,year:selYear,score:sc,total:questions.length,pct:Math.round(sc/questions.length*100),timeUsed:tu,plan,createdAt:nowStr()}
    setHistory(p=>[r,...p].slice(0,50));setScreen('result')
    fetch('/api/save-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({school:selSchool,subject:selSubject,year:selYear,score:sc,total:questions.length,timeUsed:tu,plan,customerId})}).catch(()=>{})
  },[questions,selSchool,selSubject,selYear,answers,timeLeft,plan])

  // ← Backup — ใช้ parentPin (5 หลัก) ตรงๆ
  // ── Backup 3 แบบ ──
  const doBackupLocal = () => {
    // backup ลงในเครื่อง: export history + customerId เป็น JSON file
    if(!history.length){setBackupMsg('❌ ยังไม่มีประวัติผลสอบ');return}
    const data = {
      exportedAt:  new Date().toISOString(),
      customerId,
      childName:   cfg?.childName || '',
      plan,
      history,
      examCount,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `tiwchalet-backup-${customerId}-${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMsg('✅ บันทึกไฟล์ backup ลงเครื่องแล้ว')
    setTimeout(()=>setBackupMsg(''),5000)
  }

  const doBackupCloud = async () => {
    // backup ขึ้น Supabase (save-result ทุก row ที่ยังไม่มี)
    if(!history.length){setBackupMsg('❌ ยังไม่มีประวัติผลสอบ');return}
    setBackupBusy(true); setBackupType('cloud'); setBackupMsg('กำลัง sync ขึ้น Supabase...')
    let ok=0; let fail=0
    for(const r of history){
      try{
        await fetch('/api/save-result',{method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            school:r.school, subject:r.subject, year:r.year,
            score:r.score, total:r.total, timeUsed:r.timeUsed,
            plan:r.plan, customerId
          })})
        ok++
      }catch{ fail++ }
    }
    setBackupBusy(false); setBackupType(null)
    setBackupMsg(fail===0
      ? `✅ Sync ${ok} ผลสอบขึ้น Supabase แล้ว (ใช้ Restore ได้)`
      : `⚠️ Sync ${ok} สำเร็จ / ${fail} ล้มเหลว`)
    setTimeout(()=>setBackupMsg(''),8000)
  }

  const doBackup = async () => {
    // backup ขึ้น Google Sheets ผ่าน GAS — ไม่ต้องการ PIN
    setBackupBusy(true); setBackupType('sheet'); setBackupMsg('กำลัง backup ไป Google Sheets...')
    try{
      // ใช้ x-client-backup token แทน PIN — ผู้ปกครองกดได้เลย
      const headers: Record<string,string> = {
        'Content-Type': 'application/json',
        'x-client-backup': 'tiwchalet-parent',
      }
      // ถ้ามี PIN ก็ส่งด้วย (จะได้ข้อมูลครบกว่า)
      if(parentPin) headers['x-admin-pin'] = parentPin
      const res=await fetch('/api/backup',{
        method:'POST',
        headers,
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
    finally{setBackupBusy(false); setBackupType(null); setTimeout(()=>setBackupMsg(''),8000)}
  }

  const saveProfile=async()=>{
    if(!parentPin){alert('กรุณาเข้าโหมดผู้ปกครองก่อน');return}
    setSavingProfile(true)
    try{
      const res=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','x-admin-pin':parentPin},body:JSON.stringify({child_name:editName,child_avatar_url:editAvatar,parent_name:editParentName})})
      const data=await res.json()
      if(data.ok){setCfg(p=>p?{...p,childName:editName,childAvatarUrl:editAvatar,parentName:editParentName}:p);setEditingProfile(false)}
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
  const parentName=cfg?.parentName||editParentName||'คุณแม่'
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

      {/* ── PROFILE MODAL (overlay จากทุก screen) ── */}
      {showProfileModal&&mode==='parent'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:20,padding:'24px 20px',width:'100%',maxWidth:360,maxHeight:'90dvh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text}}>แก้ไขข้อมูลนักเรียน</div>
              <button onClick={()=>setShowProfileModal(false)} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:C.muted}}>×</button>
            </div>
            {/* รูป preview + resize */}
            <div style={{textAlign:'center',marginBottom:16}}>
              {editAvatar?(
                <div style={{position:'relative',display:'inline-block'}}>
                  <img id="profilePreview" src={editAvatar} alt="" style={{width:120,height:120,borderRadius:24,objectFit:'cover',border:`3px solid ${C.green}`,display:'block'}}/>
                  <div style={{fontSize:11,color:C.muted,marginTop:6}}>รูปตัวอย่าง 120×120px</div>
                </div>
              ):(
                <div style={{width:120,height:120,borderRadius:24,background:`linear-gradient(135deg,${C.blueL},${C.greenL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:56,margin:'0 auto',border:`3px solid ${C.green}`}}>🧒</div>
              )}
            </div>
            {/* Upload รูป */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:600,color:C.muted,display:'block',marginBottom:6}}>รูปโปรไฟล์</label>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <button onClick={()=>{const inp=document.getElementById('pmAvatarFile') as HTMLInputElement;inp?.click()}}
                  style={{padding:'10px 8px',borderRadius:10,border:`2px dashed #cbd5e1`,background:'#fafafa',cursor:'pointer',fontFamily:'inherit',fontSize:12,color:C.muted,fontWeight:500}}>
                  📷 เลือกรูป JPG<br/><span style={{fontSize:10,opacity:.7}}>≤ 1 MB</span>
                </button>
                <input value={editAvatar.startsWith('data:')?'':editAvatar}
                  onChange={e=>setEditAvatar(e.target.value)}
                  placeholder="URL รูปภาพ"
                  style={{padding:'8px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:12,color:C.text,outline:'none',fontFamily:'inherit'}}/>
              </div>
              <input id="pmAvatarFile" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{display:'none'}} onChange={e=>{
                const file=e.target.files?.[0]; if(!file) return
                if(file.size>1024*1024){alert('ไฟล์ใหญ่เกิน 1 MB');return}
                // Resize รูปลงเป็น 400x400 ก่อนบันทึก
                const img=new Image(); const url=URL.createObjectURL(file)
                img.onload=()=>{
                  const SIZE=400
                  const canvas=document.createElement('canvas')
                  canvas.width=SIZE; canvas.height=SIZE
                  const ctx=canvas.getContext('2d')!
                  const s=Math.min(img.width,img.height)
                  const sx=(img.width-s)/2; const sy=(img.height-s)/2
                  ctx.drawImage(img,sx,sy,s,s,0,0,SIZE,SIZE)
                  setEditAvatar(canvas.toDataURL('image/jpeg',0.85))
                  URL.revokeObjectURL(url)
                }
                img.src=url
              }}/>
              <div style={{fontSize:10,color:C.muted}}>รองรับ JPG/PNG · auto resize เป็น 400×400px · crop จากกึ่งกลาง</div>
            </div>
            {/* ชื่อผู้ปกครอง */}
            <div style={{marginBottom:10}}>
              <label style={{fontSize:12,fontWeight:600,color:C.muted,display:'block',marginBottom:6}}>ชื่อผู้ปกครอง (แสดงใน topbar)</label>
              <input value={editParentName} onChange={e=>setEditParentName(e.target.value)}
                placeholder="เช่น คุณแม่, คุณพ่อ, คุณยาย"
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:fs,color:C.text,outline:'none',fontFamily:'inherit'}}/>
            </div>
            {/* ชื่อนักเรียน */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:12,fontWeight:600,color:C.muted,display:'block',marginBottom:6}}>ชื่อนักเรียน</label>
              <input value={editName} onChange={e=>setEditName(e.target.value)}
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:fs,color:C.text,outline:'none',fontFamily:'inherit'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <button onClick={()=>setShowProfileModal(false)}
                style={{padding:'11px',borderRadius:11,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,fontSize:fs-1,cursor:'pointer',fontFamily:'inherit'}}>ยกเลิก</button>
              <button onClick={async()=>{await saveProfile();setShowProfileModal(false)}} disabled={savingProfile}
                style={{padding:'11px',borderRadius:11,border:'none',background:savingProfile?'#94a3b8':C.green,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:savingProfile?'default':'pointer',fontFamily:'inherit'}}>
                {savingProfile?'กำลังบันทึก...':'💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE MODAL ── */}
      {showRestoreModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:20,padding:'24px 20px',width:'100%',maxWidth:360}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700,color:C.text}}>♻️ Restore ข้อมูล</div>
              <button onClick={()=>{setShowRestoreModal(false);setRestoreMsg('')}} style={{background:'none',border:'none',fontSize:24,cursor:'pointer',color:C.muted}}>×</button>
            </div>
            <div style={{background:C.blueL,border:`1px solid #bfdbfe`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:12,color:'#1e40af'}}>
              <div style={{fontWeight:600,marginBottom:3}}>แบบที่ 1 — Restore ประวัติตัวเอง</div>
              ใส่ CustomerID เก่า (เช่น CUS-LKJ3X-A1B2) เพื่อดึงประวัติผลสอบกลับมา
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:12,fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>CustomerID</label>
              <input value={restoreId} onChange={e=>setRestoreId(e.target.value.toUpperCase())}
                placeholder="CUS-XXXXX-XXXX"
                style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:14,fontFamily:'monospace',color:C.text,outline:'none'}}/>
              <div style={{fontSize:10,color:C.muted,marginTop:4}}>CustomerID อยู่ใน Settings → ข้อมูลนักเรียน</div>
            </div>
            {restoreMsg&&<div style={{fontSize:13,padding:'8px 10px',borderRadius:9,background:restoreMsg.startsWith('✅')?C.greenL:C.redL,color:restoreMsg.startsWith('✅')?C.greenD:C.red,marginBottom:10,lineHeight:1.5}}>{restoreMsg}</div>}
            <button onClick={async()=>{
              if(!restoreId.trim()){setRestoreMsg('❌ กรุณาใส่ CustomerID');return}
              setRestoreBusy(true);setRestoreMsg('')
              try{
                const res=await fetch('/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:restoreId.trim(),mode:'self'})})
                const data=await res.json()
                if(data.ok){
                  setHistory(data.history||[])
                  setRestoreMsg(`✅ ${data.message}`)
                  setTimeout(()=>setShowRestoreModal(false),2000)
                }else{setRestoreMsg('❌ '+data.error)}
              }catch{setRestoreMsg('❌ เชื่อมต่อไม่ได้')}
              finally{setRestoreBusy(false)}
            }} disabled={restoreBusy}
              style={{width:'100%',padding:'12px',borderRadius:11,border:'none',background:restoreBusy?'#94a3b8':C.navy,color:'#fff',fontSize:14,fontWeight:600,cursor:restoreBusy?'default':'pointer',fontFamily:'inherit'}}>
              {restoreBusy?<><span className="spin">⟳</span> กำลัง Restore...</>:'♻️ Restore ประวัติ'}
            </button>
            <div style={{marginTop:12,padding:'10px 12px',background:'#f8fafc',borderRadius:9,fontSize:11,color:C.muted}}>
              CustomerID ของ device นี้: <strong style={{fontFamily:'monospace',fontSize:12,color:C.text}}>{customerId}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT MODAL — A4 JPG ── */}
      {showReportModal&&mode==='parent'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:900,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',overflowY:'auto',padding:'20px 16px'}}>
          <div style={{width:'100%',maxWidth:500,marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{color:'#fff',fontSize:16,fontWeight:700}}>📄 รายงานผลการเรียน</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{
                const el=document.getElementById('reportA4')
                if(!el) return
                import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' as any).catch(()=>{}).then(()=>{
                  const h2c=(window as any).html2canvas
                  if(!h2c){alert('กรุณารอสักครู่แล้วลองใหม่');return}
                  h2c(el,{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then((canvas:any)=>{
                    const link=document.createElement('a')
                    link.download=`รายงาน-${childName}-${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.jpg`
                    link.href=canvas.toDataURL('image/jpeg',0.92)
                    link.click()
                  })
                })
              }} style={{padding:'7px 14px',borderRadius:8,border:'none',background:'#16a34a',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                💾 บันทึก JPG
              </button>
              <button onClick={()=>setShowReportModal(false)} style={{padding:'7px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.3)',background:'transparent',color:'#fff',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>✕ ปิด</button>
            </div>
          </div>

          {/* A4 Report Card */}
          <div id="reportA4" style={{
            width:595,background:'#fff',borderRadius:4,
            padding:'32px 36px',fontFamily:'Sarabun,sans-serif',
            minHeight:842,boxSizing:'border-box',
          }}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',gap:16,borderBottom:'3px solid #1e293b',paddingBottom:16,marginBottom:20}}>
              {cfg?.childAvatarUrl
                ?<img src={cfg.childAvatarUrl} alt="" style={{width:72,height:72,borderRadius:14,objectFit:'cover',border:'3px solid #16a34a'}}/>
                :<div style={{width:72,height:72,borderRadius:14,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>🧒</div>
              }
              <div style={{flex:1}}>
                <div style={{fontSize:22,fontWeight:700,color:'#0f172a',marginBottom:3}}>{childName}</div>
                <div style={{fontSize:13,color:'#64748b'}}>เป้าหมาย: {cfg?.childTargetSchool||'ติวเข้า ม.1'}</div>
                <div style={{fontSize:13,color:'#64748b'}}>พิมพ์วันที่ {new Date().toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:28,fontWeight:800,color:'#1e293b'}}>{history.length?avgPct:'—'}%</div>
                <div style={{fontSize:12,color:'#64748b'}}>คะแนนเฉลี่ย</div>
              </div>
            </div>

            {/* Summary boxes */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
              {[
                {v:history.length,l:'ชุดที่ทำ',c:'#1d4ed8',bg:'#eff6ff'},
                {v:history.length?avgPct+'%':'—',l:'คะแนนเฉลี่ย',c:'#16a34a',bg:'#f0fdf4'},
                {v:history.filter(r=>r.pct>=80).length,l:'ดีมาก ≥80%',c:'#16a34a',bg:'#dcfce7'},
                {v:history.filter(r=>r.pct<60).length||'✓',l:'ต้องปรับปรุง',c:history.filter(r=>r.pct<60).length?'#dc2626':'#16a34a',bg:history.filter(r=>r.pct<60).length?'#fef2f2':'#dcfce7'},
              ].map(s=>(
                <div key={s.l} style={{background:s.bg,borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                  <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:10,color:s.c,opacity:.8,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Per-subject */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:10,borderLeft:'4px solid #1e293b',paddingLeft:8}}>คะแนนแต่ละวิชา</div>
              {(['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English'] as const).map(subj=>{
                const rows=history.filter(r=>r.subject===subj)
                if(!rows.length) return <div key={subj} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,opacity:.4}}>
                  <div style={{width:20,fontSize:13}}>{'➗🔬📖🇬🇧'[['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English'].indexOf(subj)]}</div>
                  <div style={{fontSize:12,width:100}}>{subj}</div>
                  <div style={{flex:1,height:6,background:'#f1f5f9',borderRadius:3}}/>
                  <div style={{fontSize:11,color:'#94a3b8',width:40,textAlign:'right'}}>ยังไม่ทำ</div>
                </div>
                const avg=Math.round(rows.reduce((a,r)=>a+r.pct,0)/rows.length)
                const best=Math.max(...rows.map(r=>r.pct))
                return (<div key={subj} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{width:20,fontSize:14}}>{'➗🔬📖🇬🇧'[['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English'].indexOf(subj)]}</div>
                  <div style={{fontSize:12,fontWeight:600,width:100,color:'#1e293b'}}>{subj}</div>
                  <div style={{flex:1,height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${avg}%`,background:avg>=70?'#16a34a':'#dc2626',borderRadius:4}}/>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:avg>=70?'#16a34a':'#dc2626',width:36,textAlign:'right'}}>{avg}%</div>
                  <div style={{fontSize:10,color:'#94a3b8',width:48,textAlign:'right'}}>สูงสุด {best}%</div>
                </div>)
              })}
            </div>

            {/* Recent history */}
            {history.length>0&&(<div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:8,borderLeft:'4px solid #1e293b',paddingLeft:8}}>ประวัติผลสอบล่าสุด (10 ชุด)</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    {['วันที่','โรงเรียน','วิชา','คะแนน','%'].map(h=>(
                      <th key={h} style={{padding:'5px 8px',textAlign:'left',color:'#64748b',fontWeight:600,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0,10).map((r,i)=>(
                    <tr key={r.id} style={{background:i%2?'#f8fafc':'#fff'}}>
                      <td style={{padding:'5px 8px',color:'#64748b'}}>{r.createdAt}</td>
                      <td style={{padding:'5px 8px',color:'#0f172a',fontWeight:500}}>{r.school}</td>
                      <td style={{padding:'5px 8px',color:'#64748b'}}>{r.subject}</td>
                      <td style={{padding:'5px 8px',color:'#0f172a'}}>{r.score}/{r.total}</td>
                      <td style={{padding:'5px 8px',fontWeight:700,color:r.pct>=70?'#16a34a':'#dc2626'}}>{r.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>)}

            {/* Footer */}
            <div style={{borderTop:'1px solid #e2e8f0',paddingTop:12,display:'flex',justifyContent:'space-between',fontSize:10,color:'#94a3b8',marginTop:'auto'}}>
              <span>ติวฉลาด — แอปติวสอบเข้า ม.1</span>
              <span>CustomerID: {customerId}</span>
              <span>tiwchalet.vercel.app</span>
            </div>
          </div>

          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" async/>
        </div>
      )}

      {/* TOP BAR */}
      {screen!=='exam'&&(
        <div style={{background:'#fff',borderBottom:`1px solid ${C.border}`,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:9,cursor:mode==='parent'?'pointer':'default'}} onClick={()=>{if(mode==='parent'){setEditName(cfg?.childName||'');setEditAvatar(cfg?.childAvatarUrl||'');setShowProfileModal(true);setScreen('settings')}}}>
            {childAvatar
              ?<img src={childAvatar} alt="" style={{width:36,height:36,borderRadius:10,objectFit:'cover',border:`2px solid ${mode==='parent'?C.green:C.border}`}}/>
              :<div style={{width:36,height:36,borderRadius:10,background:mode==='parent'?C.greenL:C.blueL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{mode==='parent'?'👩':'🧒'}</div>
            }
            <div>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:fs,fontWeight:600,color:C.text}}>{mode==='parent'?parentName:childName}</span>
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

                {/* Quick actions grid */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  {[
                    {icon:'📱',label:'1. Backup เครื่อง',fn:doBackupLocal,c:'#1d4ed8'},
                    {icon:'☁️',label:'2. Sync Supabase',fn:doBackupCloud,c:'#0891b2'},
                    {icon:'📊',label:'3. Sheets (ไม่ต้อง PIN)',fn:doBackup,c:C.green},
                    {icon:'♻️',label:'4. Restore',fn:()=>setShowRestoreModal(true),c:C.blue},
                    {icon:'📄',label:'5. รายงาน A4',fn:()=>setShowReportModal(true),c:'#7c3aed',disabled:!history.length},
                    {icon:'⚙️',label:'6. ตั้งค่า',fn:()=>setScreen('settings'),c:C.muted},
                  ].map(b=>(
                    <button key={b.label} onClick={b.fn} disabled={b.disabled||backupBusy}
                      style={{display:'flex',alignItems:'center',gap:7,padding:'9px 10px',borderRadius:11,border:`1px solid ${C.border}`,background:'#fff',color:b.disabled?C.muted:b.c,cursor:b.disabled||backupBusy?'default':'pointer',fontFamily:'inherit',fontSize:Math.max(11,fs-2),fontWeight:500,opacity:b.disabled?.5:1}}>
                      <span style={{fontSize:16}}>{b.icon}</span>
                      <span>{b.label}</span>
                    </button>
                  ))}
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
        {/* Cancel confirm modal */}
        {showCancelConfirm&&(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{background:'#fff',borderRadius:18,padding:'28px 22px',width:'100%',maxWidth:300,textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>⚠️</div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>หยุดทำข้อสอบ?</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:20}}>ความคืบหน้าจะหายไป ยืนยันหยุดหรือไม่?</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <button onClick={()=>setShowCancelConfirm(false)} style={{padding:'11px',borderRadius:11,border:`1.5px solid ${C.border}`,background:'transparent',color:C.text,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>ทำต่อ</button>
                <button onClick={cancelExam} style={{padding:'11px',borderRadius:11,border:'none',background:C.red,color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>หยุดเลย</button>
              </div>
            </div>
          </div>
        )}
        {screen==='exam'&&questions.length>0&&(<div className="fu">
          <div style={{background:'#fff',borderRadius:14,padding:'12px 14px',marginBottom:12,border:`1px solid ${C.border}`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div><div style={{fontSize:fs,fontWeight:700,color:C.text}}>{selSchool} · {SUBJ_ICON[selSubject]} {selSubject}</div><div style={{fontSize:Math.max(11,fs-3),color:C.muted}}>ตอบแล้ว {Object.keys(answers).length}/{questions.length} ข้อ</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:fs+6,fontWeight:700,color:timeLeft<60?C.red:C.green,fontVariantNumeric:'tabular-nums'}}>{fmtSec(timeLeft)}</div><div style={{fontSize:10,color:C.muted}}>เหลือเวลา</div></div>
            </div>
            <button onClick={()=>setShowCancelConfirm(true)} style={{width:'100%',padding:'7px',borderRadius:8,border:`1px solid #fca5a5`,background:'#fff',color:C.red,fontSize:Math.max(11,fs-3),cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
              ✕ ยกเลิก / หยุดทำข้อสอบ
            </button>
          </div>
          <div style={{height:4,background:'#f1f5f9',borderRadius:2,marginBottom:14,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Object.keys(answers).length/questions.length*100}%`,background:C.navy,transition:'width .3s'}}/>
          </div>
          {questions.map(q=>{
            const opts=q.opts||[q.opt_a||'',q.opt_b||'',q.opt_c||'',q.opt_d||'']
            return (<div key={q.id} style={{background:'#fff',borderRadius:14,padding:'14px',marginBottom:10,border:`2px solid ${answers[q.id]!==undefined?C.navy:C.border}`,transition:'border-color .15s'}}>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <div style={{width:24,height:24,borderRadius:7,background:answers[q.id]!==undefined?C.navy:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:answers[q.id]!==undefined?'#fff':C.muted,flexShrink:0}}>{q.id.toString().slice(-2)}</div>
                <div style={{fontSize:fs,fontWeight:500,color:C.text,lineHeight:1.6}}>{q.text}</div>
              </div>
              {q.image_url&&<img src={q.image_url} alt="โจทย์" style={{width:'100%',maxHeight:200,objectFit:'contain',borderRadius:9,border:`1px solid ${C.border}`,marginBottom:9}}/>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {opts.map((opt,oi)=>{
                  const sel=answers[q.id]===oi
                  const imgs=[q.opt_a_img,q.opt_b_img,q.opt_c_img,q.opt_d_img]
                  const oi_img=imgs[oi]
                  return <button key={oi} onClick={()=>setAnswers(p=>({...p,[q.id]:oi}))}
                    style={{padding:'10px 12px',borderRadius:10,border:`2px solid ${sel?C.navy:C.border}`,background:sel?C.navy:'#fafafa',color:sel?'#fff':C.text,fontSize:fs-1,cursor:'pointer',fontFamily:'inherit',textAlign:'left',fontWeight:sel?600:400,transition:'all .12s'}}>
                    {oi_img&&<img src={oi_img} alt={opt} style={{width:'100%',maxHeight:80,objectFit:'contain',borderRadius:6,marginBottom:4,display:'block'}}/>}
                    {opt}
                  </button>
                })}
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
              <div style={{display:'flex',gap:7,marginBottom:6}}>
                <div style={{width:22,height:22,borderRadius:6,background:ok?C.greenL:C.redL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{ok?'✓':'✗'}</div>
                <div style={{fontSize:fs,fontWeight:500,color:C.text,lineHeight:1.55}}>{q.text}</div>
              </div>
              {q.image_url&&<img src={q.image_url} alt="โจทย์" style={{width:'100%',maxHeight:180,objectFit:'contain',borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8}}/>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:q.explain||q.explain_img?9:0}}>
                {opts.map((opt,oi)=>{
                  const isAns=oi===q.ans;const isUser=oi===ua
                  const imgs=[q.opt_a_img,q.opt_b_img,q.opt_c_img,q.opt_d_img]
                  const oi_img=imgs[oi]
                  return <div key={oi} style={{padding:'7px 9px',borderRadius:8,border:`1.5px solid ${isAns?C.green:isUser&&!ok?C.red:C.border}`,background:isAns?C.greenL:isUser&&!ok?C.redL:'#fafafa',fontSize:fs-2,color:isAns?C.greenD:isUser&&!ok?'#991b1b':C.muted,fontWeight:isAns?600:400}}>
                    {oi_img&&<img src={oi_img} alt={opt} style={{width:'100%',maxHeight:70,objectFit:'contain',borderRadius:5,marginBottom:4,display:'block'}}/>}
                    {opt}{isAns?' ✓':''}{isUser&&!ok?' ✗':''}
                  </div>
                })}
              </div>
              {(q.explain||q.explain_img)&&<div style={{background:'#f9fafb',borderRadius:8,padding:'8px 10px',fontSize:fs-2,color:C.text,lineHeight:1.6}}>
                💡 {q.explain}
                {q.explain_img&&<img src={q.explain_img} alt="เฉลย" style={{width:'100%',maxHeight:150,objectFit:'contain',borderRadius:7,marginTop:6,border:`1px solid ${C.border}`}}/>}
              </div>}
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
                  <label style={{fontSize:Math.max(11,fs-3),fontWeight:600,color:C.muted,display:'block',marginBottom:5}}>รูปโปรไฟล์นักเรียน</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <button onClick={()=>{const inp=document.getElementById('avatarFile') as HTMLInputElement;inp?.click()}}
                      style={{padding:'10px 8px',borderRadius:10,border:`2px dashed #cbd5e1`,background:'#fafafa',cursor:'pointer',fontFamily:'inherit',fontSize:Math.max(11,fs-3),color:C.muted,fontWeight:500}}>
                      📷 เลือกไฟล์ JPG<br/><span style={{fontSize:10,opacity:.7}}>ไม่เกิน 1 MB</span>
                    </button>
                    <input value={editAvatar.startsWith('data:')?'':editAvatar} onChange={e=>setEditAvatar(e.target.value)} placeholder="หรือวาง URL รูป" style={{padding:'10px 8px',borderRadius:10,border:`1.5px solid ${C.border}`,background:'#fafafa',fontSize:Math.max(11,fs-3),color:C.text,outline:'none',fontFamily:'inherit'}}/>
                  </div>
                  <input id="avatarFile" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{display:'none'}} onChange={e=>{
                    const file=e.target.files?.[0]; if(!file) return
                    if(file.size>1024*1024){alert('ไฟล์ใหญ่เกิน 1 MB กรุณาลดขนาดก่อน');return}
                    const reader=new FileReader()
                    reader.onload=ev=>setEditAvatar(ev.target?.result as string)
                    reader.readAsDataURL(file)
                  }}/>
                  <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>รองรับ JPG/PNG/WebP ขนาดไม่เกิน 1 MB</div>
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
                  <button onClick={()=>setShowPayment(true)} style={{padding:'9px',borderRadius:10,border:'none',background:C.gold,color:'#fff',fontSize:fs-1,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>☕ สนับสนุน 100฿</button>
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

          {/* Restore ข้อมูล */}
          <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
            <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:4}}>Restore ข้อมูล</div>
            <div style={{fontSize:Math.max(11,fs-3),color:C.muted,marginBottom:10}}>ดึงประวัติผลสอบกลับมาจาก CustomerID เก่า</div>
            <div style={{background:'#f8fafc',borderRadius:9,padding:'7px 10px',marginBottom:8,fontSize:Math.max(10,fs-4),color:C.muted}}>
              CustomerID: <span style={{fontFamily:'monospace',fontWeight:600,color:C.text}}>{customerId}</span>
            </div>
            <button onClick={()=>setShowRestoreModal(true)}
              style={{width:'100%',padding:'10px',borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:C.blue,fontSize:fs-1,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              ♻️ Restore จาก CustomerID เก่า
            </button>
          </div>

          {/* รายงาน */}
          <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:12}}>
            <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:4}}>📊 รายงานผลการเรียน</div>
            <div style={{fontSize:Math.max(11,fs-3),color:C.muted,marginBottom:10}}>สร้างรายงาน A4 · บันทึกเป็น JPG เพื่อแชร์</div>
            <button onClick={()=>setShowReportModal(true)} disabled={!history.length}
              style={{width:'100%',padding:'10px',borderRadius:10,border:'none',background:history.length?C.blue:'#d1d5db',color:'#fff',fontSize:fs-1,fontWeight:600,cursor:history.length?'pointer':'default',fontFamily:'inherit'}}>
              📄 ดู / บันทึกรายงาน A4
            </button>
            {!history.length&&<div style={{fontSize:10,color:C.muted,textAlign:'center',marginTop:4}}>ต้องทำข้อสอบก่อนถึงจะสร้างรายงานได้</div>}
          </div>

          {/* Backup */}
          <div style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px'}}>
            <div style={{fontSize:fs,fontWeight:700,color:C.text,marginBottom:4}}>💾 Backup ข้อมูล</div>
            <div style={{fontSize:Math.max(11,fs-3),color:C.muted,marginBottom:10}}>เลือกวิธี backup ที่ต้องการ</div>

            {/* 3 ปุ่ม Backup */}
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>

              {/* 1. บันทึกลงเครื่อง */}
              <button onClick={doBackupLocal} disabled={backupBusy}
                style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:11,border:`1.5px solid ${C.border}`,background:'#f8fafc',cursor:'pointer',fontFamily:'inherit',textAlign:'left',width:'100%'}}>
                <div style={{width:36,height:36,borderRadius:10,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📱</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:fs-1,fontWeight:700,color:C.text}}>1. บันทึกลงเครื่อง</div>
                  <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>ดาวน์โหลด JSON file ไว้กับตัว · ใช้ได้ offline</div>
                </div>
                <span style={{fontSize:12,color:C.blue}}>↓</span>
              </button>

              {/* 2. Sync ขึ้น Supabase */}
              <button onClick={doBackupCloud} disabled={backupBusy}
                style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:11,border:`1.5px solid ${C.border}`,background:'#f8fafc',cursor:backupBusy?'default':'pointer',fontFamily:'inherit',textAlign:'left',width:'100%',opacity:backupBusy&&backupType==='cloud'?.7:1}}>
                <div style={{width:36,height:36,borderRadius:10,background:'#ecfeff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                  {backupBusy&&backupType==='cloud'?<span className="spin">⟳</span>:'☁️'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:fs-1,fontWeight:700,color:C.text}}>2. Sync ขึ้น Supabase</div>
                  <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>บันทึกขึ้น database · ใช้ Restore ข้ามเครื่องได้</div>
                </div>
                <span style={{fontSize:12,color:'#0891b2'}}>↑</span>
              </button>

              {/* 3. Backup ไป Google Sheets */}
              <button onClick={doBackup} disabled={backupBusy}
                style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:11,border:`1.5px solid ${C.border}`,background:'#f8fafc',cursor:backupBusy?'default':'pointer',fontFamily:'inherit',textAlign:'left',width:'100%',opacity:backupBusy&&backupType==='sheet'?.7:1}}>
                <div style={{width:36,height:36,borderRadius:10,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                  {backupBusy&&backupType==='sheet'?<span className="spin">⟳</span>:'📊'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:fs-1,fontWeight:700,color:C.text}}>3. Backup ไป Google Sheets</div>
                  <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>ส่งข้อมูลทั้งหมดไป Sheets · ดูสถิติได้ง่าย</div>
                </div>
                <span style={{fontSize:12,color:C.green}}>↑</span>
              </button>
            </div>

            {/* Last backup info */}
            {backupLog&&<div style={{background:'#f8fafc',borderRadius:9,padding:'7px 10px',marginBottom:6,fontSize:Math.max(10,fs-4),color:C.muted}}>
              📊 Sheets ล่าสุด: {new Date(backupLog.last_backup).toLocaleString('th-TH')} · {backupLog.rows_results} ผลสอบ {backupLog.gas_ok?'✅':'⚠️'}
            </div>}
            <div style={{background:'#fffbeb',borderRadius:9,padding:'7px 10px',fontSize:Math.max(10,fs-4),color:'#92400e'}}>
              💡 แนะนำ: กด <strong>2. Sync ขึ้น Supabase</strong> ก่อนเปลี่ยนมือถือ เพื่อให้ Restore ได้<br/>
              <span style={{opacity:.8}}>Google Sheets backup อัตโนมัติทุกอาทิตย์ หรือกดปุ่ม 3 เพื่อ backup ทันที</span>
            </div>
            {backupMsg&&<div style={{fontSize:Math.max(11,fs-3),color:backupMsg.startsWith('✅')?C.green:backupMsg.startsWith('⚠️')?C.gold:C.red,marginTop:8,textAlign:'center',fontWeight:500}}>{backupMsg}</div>}
          </div>
        </div>)}

        {/* UPGRADE */}
        {screen==='upgrade'&&(<div className="fu">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
            <div style={{fontSize:fs+2,fontWeight:700,color:C.text}}>⭐ Full Version</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            <button onClick={()=>setShowCompare(true)} style={{width:'100%',padding:'12px',borderRadius:12,border:`1px solid ${C.border}`,background:'#fff',color:C.text,fontSize:fs,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>เปรียบเทียบ ทดลอง vs Full →</button>
            <button onClick={()=>setShowPayment(true)} style={{width:'100%',padding:'14px',borderRadius:12,border:'none',background:C.gold,color:'#fff',fontSize:fs,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>☕ สนับสนุนค่ากาแฟ {cfg?.fullVersionPrice||'100'} บาท/เดือน</button>
            <button onClick={()=>openPinFor('full')} style={{width:'100%',padding:'12px',borderRadius:12,border:`1px solid ${C.border}`,background:'transparent',color:C.text,fontSize:fs,fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>🔑 มีรหัส Full Version แล้ว</button>
          </div>
        </div>)}

      </div>

      {/* ── HELP SCREEN ── */}
      {screen==='help'&&(<div className="fu" style={{paddingBottom:8}}>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:fs+4,fontWeight:700,color:C.text,marginBottom:2}}>❓ วิธีใช้งาน</div>
          <div style={{fontSize:fs-1,color:C.muted}}>คู่มือฉบับย่อ — ติวฉลาด {VERSION}</div>
        </div>

        {/* Quick cards */}
        {[
          {
            n:'1', icon:'📝', title:'เริ่มทำข้อสอบ',
            color:C.blue, bg:C.blueL,
            steps:[
              'กดเมนู "2 สอบ" ที่ด้านล่าง',
              'เลือกปี → วิชา → โรงเรียน',
              'กด "เริ่ม" → ตอบคำถาม → ส่งคำตอบ',
              'ดูเฉลยละเอียดทุกข้อได้ทันที',
            ]
          },
          {
            n:'2', icon:'📊', title:'ดูผลและประวัติ',
            color:'#7c3aed', bg:'#ede9fe',
            steps:[
              'กดเมนู "3 ผล" เพื่อดูประวัติทั้งหมด',
              'เห็นคะแนน % และกราฟแต่ละวิชา',
              'ผู้ปกครอง: กด "1 Dashboard" เพื่อดูสถิติ',
            ]
          },
          {
            n:'3', icon:'🔒', title:'โหมดผู้ปกครอง',
            color:C.green, bg:C.greenL,
            steps:[
              'กดปุ่ม "🔒 ผู้ปกครอง" มุมขวาบน',
              'ใส่รหัส 4 หลัก (ได้จากแอดมิน)',
              'ดู Dashboard · Restore · รายงาน A4',
              'กด "🔓 ออก" เพื่อกลับโหมดนักเรียน',
            ]
          },
          {
            n:'4', icon:'⭐', title:'Full Version',
            color:C.gold, bg:C.goldL,
            steps:[
              'ทดลอง: 2 โรงเรียน · 10 ข้อ/ชุด',
              'Full Version: ทุกโรงเรียน ไม่จำกัด',
              'สนับสนุนค่ากาแฟ 100 บาท/เดือน',
              'กดเมนู "4 Full" → สแกน QR โอนเงิน → แนบสลิป',
              'แอดมินส่ง PIN ให้ทาง LINE ภายใน 24 ชม.',
            ]
          },
          {
            n:'5', icon:'♻️', title:'Backup & Restore',
            color:'#0891b2', bg:'#ecfeff',
            steps:[
              '📱 Backup เครื่อง → ดาวน์โหลด JSON ไว้กับตัว (offline)',
              '☁️ Sync Supabase → บันทึกขึ้น database (ต้อง internet)',
              '📊 Google Sheets → เก็บสถิติ ดูได้ง่าย (ต้องมี PIN)',
              '─── Restore ───',
              'เปิดแอปบนมือถือ**เก่า** → Settings → จด CustomerID',
              'เปิดแอปบน**เครื่องใหม่** → ผู้ปกครอง → Restore',
              'ใส่ CustomerID เก่า → กด Restore → ประวัติกลับมา ✅',
              '⚠️ ต้องเคย Sync Supabase ก่อน ถึงจะ Restore ได้',
            ]
          },
          {
            n:'6', icon:'📄', title:'รายงาน A4',
            color:'#0f172a', bg:'#f8fafc',
            steps:[
              'เข้าโหมดผู้ปกครอง → Settings → รายงาน',
              'กด "ดู / บันทึกรายงาน A4"',
              'กด "💾 บันทึก JPG" → download ไฟล์',
              'แชร์ให้ครูหรือเก็บไว้ติดตาม',
            ]
          },
        ].map(card=>(
          <div key={card.n} style={{background:'#fff',border:`1px solid ${C.border}`,borderRadius:14,padding:'14px',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:34,height:34,borderRadius:10,background:card.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{card.icon}</div>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:20,background:card.bg,color:card.color}}>ขั้นที่ {card.n}</span>
                </div>
                <div style={{fontSize:fs,fontWeight:700,color:C.text}}>{card.title}</div>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {card.steps.map((s,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                  <div style={{width:18,height:18,borderRadius:9,background:card.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:card.color,flexShrink:0,marginTop:1}}>{i+1}</div>
                  <div style={{fontSize:Math.max(12,fs-2),color:C.text,lineHeight:1.5}}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Contact */}
        <div style={{background:C.greenL,border:`1px solid #86efac`,borderRadius:14,padding:'14px',marginBottom:10}}>
          <div style={{fontSize:fs,fontWeight:700,color:C.greenD,marginBottom:8}}>📞 ติดต่อแอดมิน</div>
          <a href={`https://line.me/ti/p/~${cfg?.adminLineId||'Oady'}`} target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background:'#06c755',color:'#fff',textDecoration:'none',marginBottom:6}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 5.92 2 10.74c0 2.61 1.34 4.94 3.45 6.51L4.5 21l4.05-1.96C9.6 19.64 10.78 19.85 12 19.85c5.52 0 10-3.92 10-8.74S17.52 2 12 2z"/></svg>
            <div>
              <div style={{fontSize:fs-1,fontWeight:700}}>Add LINE OA ติวฉลาด</div>
              <div style={{fontSize:10,opacity:.85}}>@{cfg?.adminLineId||'Oady'}</div>
            </div>
          </a>
          <div style={{fontSize:Math.max(11,fs-3),color:C.greenD,opacity:.8}}>
            📧 {cfg?.adminEmail||'thitiphankk@gmail.com'}<br/>
            ⏰ ตอบกลับภายใน 24 ชั่วโมง
          </div>
        </div>

        {/* App info */}
        <div style={{background:'#f8fafc',borderRadius:12,padding:'12px',textAlign:'center'}}>
          <div style={{fontSize:fs-1,fontWeight:700,color:C.text,marginBottom:3}}>ติวฉลาด {VERSION}</div>
          <div style={{fontSize:Math.max(10,fs-4),color:C.muted}}>แอปติวสอบเข้า ม.1 โรงเรียนดัง กทม.<br/>tiwchalet.vercel.app</div>
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>CustomerID: {customerId}</div>
        </div>
      </div>)}

      {/* BOTTOM NAV */}
      {screen!=='exam'&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-around',padding:'8px 0 max(10px,env(safe-area-inset-bottom))',zIndex:50}}>
          {(mode==='student'
            ?[{id:'home',icon:'🏠',label:'1 หลัก'},{id:'pick',icon:'📝',label:'2 สอบ'},{id:'progress',icon:'📊',label:'3 ผล'},{id:'upgrade',icon:'⭐',label:'4 Full'},{id:'help',icon:'❓',label:'5 ช่วย'}]
            :[{id:'home',icon:'📊',label:'1 Dashboard'},{id:'pick',icon:'📝',label:'2 ข้อสอบ'},{id:'progress',icon:'📋',label:'3 ประวัติ'},{id:'settings',icon:'⚙️',label:'4 ตั้งค่า'},{id:'help',icon:'❓',label:'5 ช่วยเหลือ'}]
          ).map((item:any)=>(
            <button key={item.id} onClick={()=>setScreen(item.id as Screen)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',minWidth:52,padding:'4px 6px'}}>
              <span style={{fontSize:22}}>{item.icon}</span>
              <span style={{fontSize:9,color:screen===item.id?C.green:C.muted,fontWeight:screen===item.id?700:400,letterSpacing:-0.3}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
