'use client'
// ═══════════════════════════════════════════════════════
//  TiwChalet — Main App  v1.0.0
//  Mobile-first · Responsive · Thai + English exams
// ═══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Subject, Question, ExamResult } from '@/types'

// ── version ──────────────────────────────────────────
const VERSION = 'v1.0.0'

// ── types ─────────────────────────────────────────────
type Plan   = 'trial' | 'full'
type Screen = 'home' | 'pick' | 'exam' | 'result' | 'progress' | 'upgrade'
type PinType = 'parent' | 'full'

interface AppSettings {
  childName: string
  childAvatarUrl: string
  childTargetSchool: string
  qrCodeImageUrl: string
  adminPhone: string
  adminEmail: string
  adminLineId: string
  fullVersionPrice: string
}

// ── helpers ───────────────────────────────────────────
const fmtSec = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const nowStr = () => new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'})
const subjectIcon: Record<string,string> = {
  'คณิตศาสตร์':'➗','วิทยาศาสตร์':'🔬','ภาษาไทย':'📖','English':'🇬🇧'
}

const SCHOOLS = ['สวนกุหลาบ','สามเสน','สาธิตจุฬา','สาธิตประสานมิตร','บดินทรเดชา','หอวัง']
const SUBJECTS: Subject[] = ['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','English']
const TRIAL_LIMIT = 3
const TRIAL_SCHOOLS = 2

// ── PinModal ─────────────────────────────────────────
function PinModal({type, onSuccess, onCancel}: {type: PinType, onSuccess:(token:string, extra?:any)=>void, onCancel:()=>void}) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [shake, setShake] = useState(false)
  const clientId = typeof window !== 'undefined' ? (localStorage.getItem('cid') || Math.random().toString(36).slice(2)) : 'x'

  const tap = async (d: string) => {
    if (busy) return
    const next = d === '⌫' ? pin.slice(0,-1) : pin + d
    if (next.length > 4) return
    setPin(next); setErr('')
    if (next.length === 4) {
      setBusy(true)
      try {
        const res = await fetch('/api/pin', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ pin:next, type, clientId })
        })
        const data = await res.json()
        if (data.ok) {
          onSuccess(data.token, data)
        } else {
          setShake(true); setErr(data.error || 'PIN ไม่ถูกต้อง'); setPin('')
          setTimeout(()=>setShake(false),400)
        }
      } catch { setErr('เชื่อมต่อไม่ได้'); setPin('') }
      finally { setBusy(false) }
    }
  }

  const label = type === 'parent' ? '🔒 โหมดผู้ปกครอง' : '⭐ Full Version'
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{maxWidth:320,margin:'0 auto'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:36,marginBottom:8}}>{type==='parent'?'🔒':'⭐'}</div>
          <div style={{fontSize:17,fontWeight:700,color:'var(--text)',marginBottom:4}}>{label}</div>
          <div style={{fontSize:13,color:err?'var(--red)':'var(--muted)',minHeight:20,marginBottom:4}}>{err || 'ใส่รหัส 4 หลัก'}</div>
          <div className={`pin-dots${shake?' shake':''}`}>
            {[0,1,2,3].map(i=><div key={i} className={`pin-dot${i<pin.length?err?' error':' filled':''}`}/>)}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i)=>(
            d===''?<div key={i}/>:
            <button key={i} onClick={()=>tap(d)} disabled={busy}
              style={{height:52,borderRadius:12,border:'1px solid var(--border)',background:'#fafafa',fontSize:d==='⌫'?17:20,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'var(--text)'}}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{width:'100%',padding:'8px',background:'none',border:'none',color:'var(--muted)',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>ยกเลิก</button>
        {type==='parent'&&<div style={{fontSize:11,color:'var(--muted)',textAlign:'center',marginTop:6}}>เริ่มต้น: 1234 (เปลี่ยนได้ใน Admin)</div>}
      </div>
    </div>
  )
}

// ── UpgradeModal ──────────────────────────────────────
function UpgradeModal({settings, daysLeft, plan, onClose, onUnlock, onBackToTrial}:
  {settings:AppSettings|null, daysLeft:number, plan:Plan, onClose:()=>void, onUnlock:()=>void, onBackToTrial:()=>void}) {
  const [tab, setTab] = useState<'info'|'contact'>('info')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const submitContact = async () => {
    if (!name.trim()) return
    setSending(true)
    try {
      await fetch('/api/upgrade-notify', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, contact, note })
      })
      setSent(true)
    } catch { alert('เกิดข้อผิดพลาด ลองใหม่') }
    finally { setSending(false) }
  }

  const phone  = settings?.adminPhone  || '0XX-XXX-XXXX'
  const email  = settings?.adminEmail  || 'thitiphankk@gmail.com'
  const lineId = settings?.adminLineId || 'Oady'
  const price  = settings?.fullVersionPrice || '299'
  const qrUrl  = settings?.qrCodeImageUrl  || ''

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        {showPin && <PinModal type="full" onSuccess={(_t,data)=>{onUnlock(); if(data) {} setShowPin(false)}} onCancel={()=>setShowPin(false)}/>}

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>⭐ Full Version</div>
          <div style={{display:'flex',gap:6}}>
            {plan==='full'&&(
              <button onClick={onBackToTrial} style={{fontSize:12,padding:'5px 10px',borderRadius:8,border:'1px solid var(--border)',background:'#fff',cursor:'pointer',fontFamily:'inherit',color:'var(--muted)'}}>
                ← กลับทดลอง
              </button>
            )}
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'var(--muted)'}}>×</button>
          </div>
        </div>

        {/* Full version active banner */}
        {plan==='full' && (
          <div style={{background:'var(--green-light)',border:'1px solid #86efac',borderRadius:12,padding:'12px 14px',marginBottom:16,textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:700,color:'var(--green-dark)',marginBottom:2}}>✅ ใช้งาน Full Version อยู่</div>
            <div style={{fontSize:13,color:'var(--green-dark)'}}>เหลือ <strong>{daysLeft} วัน</strong> · หมดอายุ กด "กลับทดลอง" เพื่อสลับโหมด</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {(['info','contact'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,padding:'9px',borderRadius:10,border:`1.5px solid ${tab===t?'var(--navy)':'var(--border)'}`,background:tab===t?'var(--navy)':'transparent',color:tab===t?'#fff':'var(--muted)',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:600}}>
              {t==='info'?'รายละเอียด':'แจ้งซื้อ / ติดต่อ'}
            </button>
          ))}
        </div>

        {tab==='info' && (
          <div>
            {/* Benefits */}
            <div style={{background:'var(--green-light)',border:'1px solid #86efac',borderRadius:12,padding:'12px 14px',marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:700,color:'var(--green-dark)',marginBottom:8}}>Full Version ได้อะไร</div>
              {['ข้อสอบทุกโรงเรียน ไม่จำกัด','ทุก 4 วิชา (คณิต วิทย์ ไทย English)','ประวัติผลสอบตลอดปี','แจ้งเตือน LINE OA','รายงานสัปดาห์อัตโนมัติ','Export Google Sheets'].map(b=>(
                <div key={b} style={{display:'flex',gap:6,alignItems:'flex-start',fontSize:13,color:'var(--green-dark)',marginBottom:4}}>
                  <span style={{color:'var(--green)',fontWeight:700,flexShrink:0}}>✓</span>{b}
                </div>
              ))}
            </div>

            {/* Price */}
            <div style={{background:'var(--gold-light)',border:'1px solid #fcd34d',borderRadius:12,padding:'14px',textAlign:'center',marginBottom:14}}>
              <div style={{fontSize:28,fontWeight:700,color:'#92400e'}}>{price} บาท / 30 วัน</div>
              <div style={{fontSize:13,color:'#b45309',marginTop:2}}>ไม่ต่ออายุอัตโนมัติ · ไม่มีค่าใช้จ่ายแอบแฝง</div>
            </div>

            {/* QR */}
            {qrUrl && (
              <div style={{textAlign:'center',marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:8}}>โอนเงินผ่าน QR Code</div>
                <img src={qrUrl} alt="QR ชำระเงิน" style={{width:160,height:160,borderRadius:10,border:'1px solid var(--border)',objectFit:'contain'}}/>
              </div>
            )}

            {/* Contact */}
            <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:12,padding:'12px 14px',marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:'#1e40af',marginBottom:8}}>ติดต่อ Admin</div>
              <div style={{fontSize:13,color:'#1d4ed8',lineHeight:1.9}}>
                📱 โทร: {phone}<br/>
                💬 LINE: @{lineId}<br/>
                📧 Email: {email}
              </div>
            </div>

            <button onClick={()=>setShowPin(true)} className="btn btn-full btn-gold" style={{marginBottom:8}}>
              ⭐ มีรหัส Full Version แล้ว — ใส่รหัสเพื่อปลดล็อก
            </button>
            <button onClick={()=>setTab('contact')} className="btn btn-full btn-outline">
              แจ้งความสนใจ ให้ Admin ติดต่อกลับ
            </button>
          </div>
        )}

        {tab==='contact' && !sent && (
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:12}}>แจ้งความสนใจ (Admin จะติดต่อกลับ)</div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อ-นามสกุล *"/>
              <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="LINE ID หรือเบอร์โทร"/>
              <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="หมายเหตุ เช่น ต้องการ 1 เดือน" rows={2}/>
            </div>
            <button onClick={submitContact} disabled={!name.trim()||sending} className="btn btn-full btn-green" style={{marginBottom:8}}>
              {sending?<span className="spin">⟳</span>:'ส่งข้อมูล'} — ให้ Admin ติดต่อกลับ
            </button>
            <div style={{fontSize:12,color:'var(--muted)',textAlign:'center'}}>
              LINE: @{lineId} · {email}
            </div>
          </div>
        )}

        {tab==='contact' && sent && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontSize:17,fontWeight:700,color:'var(--text)',marginBottom:8}}>ส่งข้อมูลแล้ว!</div>
            <div style={{fontSize:14,color:'var(--muted)',lineHeight:1.7}}>Admin จะติดต่อกลับภายใน 24 ชั่วโมง</div>
            <div style={{fontSize:13,color:'#1d4ed8',marginTop:10}}>LINE: @{lineId} · {phone}</div>
            <button onClick={onClose} className="btn btn-primary" style={{marginTop:20}}>ปิด</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────
export default function Home() {
  const [plan, setPlan]       = useState<Plan>('trial')
  const [isParent, setParent] = useState(false)
  const [screen, setScreen]   = useState<Screen>('home')
  const [settings, setSettings] = useState<AppSettings|null>(null)

  const [showPinModal, setShowPinModal]     = useState<PinType|null>(null)
  const [showUpgradeModal, setShowUpgrade]  = useState(false)

  // full version expiry
  const [fullExpiry, setFullExpiry] = useState<string|null>(null)
  const daysLeft = fullExpiry ? Math.max(0, Math.ceil((new Date(fullExpiry).getTime()-Date.now())/86400000)) : 0

  // exam state
  const [selSchool, setSelSchool] = useState('')
  const [selSubject, setSelSubject] = useState<Subject>('คณิตศาสตร์')
  const [selYear, setSelYear] = useState('2566')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string,number>>({})
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [timerOn, setTimerOn] = useState(false)
  const [history, setHistory] = useState<ExamResult[]>([])
  const [examCount, setExamCount] = useState(0)

  // profile - load from settings or localStorage
  const [childName, setChildName] = useState('น้องมิ้น')
  const [childAvatar, setChildAvatar] = useState('')

  useEffect(()=>{
    // load persisted state
    try {
      const saved = localStorage.getItem('tiwchalet-v1')
      if (saved) {
        const p = JSON.parse(saved)
        if (p.plan) setPlan(p.plan)
        if (p.fullExpiry) setFullExpiry(p.fullExpiry)
        if (p.history) setHistory(p.history)
        if (p.examCount) setExamCount(p.examCount)
        if (p.childName) setChildName(p.childName)
        if (p.childAvatar) setChildAvatar(p.childAvatar)
      }
    } catch {}
    // load settings from API
    fetch('/api/settings').then(r=>r.json()).then(d=>{
      if(d.settings) {
        const s = d.settings
        setSettings({
          childName: s.child_name, childAvatarUrl: s.child_avatar_url,
          childTargetSchool: s.child_target_school, qrCodeImageUrl: s.qr_code_image_url,
          adminPhone: s.admin_phone, adminEmail: s.admin_email, adminLineId: s.admin_line_id,
          fullVersionPrice: s.full_version_price,
        })
        if(s.child_name) setChildName(s.child_name)
        if(s.child_avatar_url) setChildAvatar(s.child_avatar_url)
      }
    }).catch(()=>{})
  },[])

  // persist state
  useEffect(()=>{
    try { localStorage.setItem('tiwchalet-v1', JSON.stringify({plan,fullExpiry,history,examCount,childName,childAvatar})) }
    catch {}
  },[plan,fullExpiry,history,examCount,childName,childAvatar])

  // auto-expire full version
  useEffect(()=>{
    if(plan==='full' && fullExpiry && new Date(fullExpiry) < new Date()) {
      setPlan('trial'); setFullExpiry(null)
    }
  },[plan,fullExpiry])

  // timer
  useEffect(()=>{
    if(!timerOn||timeLeft<=0) return
    const t = setInterval(()=>setTimeLeft(p=>{
      if(p<=1){clearInterval(t);submitExam();return 0}
      return p-1
    }),1000)
    return ()=>clearInterval(t)
  },[timerOn,timeLeft])

  const isFull = plan==='full' && daysLeft > 0
  const canExam = isFull || examCount < TRIAL_LIMIT
  const accessibleSchools = isFull ? SCHOOLS : SCHOOLS.slice(0,TRIAL_SCHOOLS)

  const unlockParent = (_token:string) => { setParent(true); setShowPinModal(null) }
  const lockParent   = () => setParent(false)

  const unlockFull = (_token:string, data?:any) => {
    const days = data?.fullVersionDays || 30
    const expiry = new Date(); expiry.setDate(expiry.getDate()+days)
    setPlan('full'); setFullExpiry(expiry.toISOString())
    setShowPinModal(null); setShowUpgrade(false)
  }

  const backToTrial = () => { setPlan('trial'); setFullExpiry(null); setShowUpgrade(false) }

  const loadExam = async () => {
    if(!selSchool||!selSubject){setLoadErr('เลือกโรงเรียนและวิชา');return}
    if(!canExam){setShowUpgrade(true);return}
    setLoading(true); setLoadErr(''); setQuestions([]); setAnswers({})
    try {
      const p = new URLSearchParams({school:selSchool,subject:selSubject,year:selYear})
      const res = await fetch(`/api/questions?${p}`)
      const data = await res.json()
      if(!data.ok||!data.questions.length) throw new Error(data.error||'ไม่พบข้อสอบในชุดนี้')
      setQuestions(data.questions)
      setTimeLeft(data.questions.length*90)
      setTimerOn(true)
      setExamCount(p2=>p2+1)
      setScreen('exam')
    } catch(e:any){ setLoadErr(e.message) }
    finally { setLoading(false) }
  }

  const submitExam = useCallback(()=>{
    if(!questions.length||!selSchool||!selSubject) return
    setTimerOn(false)
    const score = questions.filter(q=>answers[q.id]===q.ans).length
    const timeUsed = questions.length*90-timeLeft
    const result: ExamResult = {
      id: Date.now().toString(), school:selSchool, subject:selSubject, year:selYear,
      score, total:questions.length, pct:Math.round(score/questions.length*100),
      timeUsed, plan, createdAt:nowStr()
    }
    setHistory(p=>[result,...p].slice(0,50))
    setScreen('result')
    fetch('/api/save-result',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({school:selSchool,subject:selSubject,year:selYear,score,total:questions.length,timeUsed,plan})
    }).catch(()=>{})
  },[questions,selSchool,selSubject,selYear,answers,timeLeft,plan])

  const latestResult = history[0]
  const avgPct = history.length ? Math.round(history.reduce((a,r)=>a+r.pct,0)/history.length) : 0

  return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column'}}>
      {/* Modals */}
      {showPinModal && (
        showPinModal==='parent'
          ? <PinModal type="parent" onSuccess={unlockParent} onCancel={()=>setShowPinModal(null)}/>
          : <PinModal type="full"   onSuccess={unlockFull}   onCancel={()=>setShowPinModal(null)}/>
      )}
      {showUpgradeModal && (
        <UpgradeModal
          settings={settings} daysLeft={daysLeft} plan={plan}
          onClose={()=>setShowUpgrade(false)}
          onUnlock={()=>setShowUpgrade(false)}
          onBackToTrial={backToTrial}
        />
      )}

      {/* TOP BAR */}
      {screen!=='exam'&&(
        <div className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {childAvatar
              ? <img src={childAvatar} alt="" style={{width:36,height:36,borderRadius:10,objectFit:'cover'}}/>
              : <div style={{width:36,height:36,borderRadius:10,background:isParent?'var(--green-light)':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{isParent?'👩':'🧒'}</div>
            }
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{isParent?'คุณแม่':childName}</span>
                <span className={`badge ${isFull?'badge-full':'badge-trial'}`}>{isFull?`⭐ Full ${daysLeft}วัน`:'ทดลอง'}</span>
              </div>
              <div style={{fontSize:11,color:'var(--muted)'}}>ติวเข้า ม.1 · {settings?.childTargetSchool||'สาธิตจุฬา'} · {VERSION}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {!isFull&&<button onClick={()=>setShowUpgrade(true)} style={{fontSize:11,padding:'5px 9px',borderRadius:8,border:'1px solid #fcd34d',background:'var(--gold-light)',color:'#92400e',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>⭐</button>}
            <button onClick={()=>isParent?lockParent():setShowPinModal('parent')}
              style={{fontSize:11,padding:'5px 10px',borderRadius:8,border:`1px solid ${isParent?'#86efac':'var(--border)'}`,background:isParent?'var(--green-light)':'#f8fafc',color:isParent?'var(--green-dark)':'var(--muted)',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>
              {isParent?'🔓 ออก':'🔒 ผู้ปกครอง'}
            </button>
          </div>
        </div>
      )}

      {/* BANNERS */}
      {screen!=='exam'&&(
        <>
          {!isFull&&<div style={{background:'var(--gold-light)',borderBottom:'1px solid #fcd34d',padding:'6px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:12,color:'#92400e'}}>ทดลอง · ข้อสอบ {examCount}/{TRIAL_LIMIT} · {TRIAL_SCHOOLS} โรงเรียนแรก</span>
            <button onClick={()=>setShowUpgrade(true)} style={{fontSize:11,padding:'3px 9px',borderRadius:6,border:'none',background:'var(--gold)',color:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>อัพเกรด</button>
          </div>}
          {!isParent&&<div style={{background:'#fff7ed',borderBottom:'1px solid #fed7aa',padding:'5px 14px',fontSize:12,color:'#9a3412'}}>🔒 โหมดเด็ก — ผู้ปกครองใส่รหัสเพื่อจัดการ</div>}
        </>
      )}

      {/* CONTENT */}
      <div className="content fade-in">

        {/* ── HOME ── */}
        {screen==='home'&&(
          <div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:22,fontWeight:700,color:'var(--text)',marginBottom:2}}>สวัสดี {isParent?'คุณแม่':childName} 👋</div>
              <div style={{fontSize:14,color:'var(--muted)'}}>พร้อมทำข้อสอบวันนี้หรือยัง?</div>
            </div>

            <div className="stats-grid">
              {[
                {v:history.length||'—',l:'ชุดที่ทำ',c:'#1d4ed8',bg:'#eff6ff'},
                {v:history.length?avgPct+'%':'—',l:'คะแนนเฉลี่ย',c:'var(--green)',bg:'var(--green-light)'},
                {v:isFull?daysLeft+'วัน':TRIAL_LIMIT-examCount+'',l:isFull?'Full เหลือ':'ทดลองเหลือ',c:isFull?'var(--gold)':'#92400e',bg:'var(--gold-light)'},
              ].map(s=>(
                <div key={s.l} style={{background:s.bg,borderRadius:12,padding:'13px 8px',textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:11,color:s.c,opacity:.75,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            <button onClick={()=>setScreen('pick')} className="btn btn-full" style={{background:'var(--navy)',color:'#fff',borderRadius:16,padding:'18px 16px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'inherit'}}>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:16,fontWeight:700,marginBottom:2}}>เลือกทำข้อสอบ</div>
                <div style={{fontSize:12,opacity:.65}}>4 วิชา · 6 โรงเรียนดังกรุงเทพ</div>
              </div>
              <span style={{fontSize:30}}>📝</span>
            </button>

            {latestResult&&(
              <div className="card" style={{marginBottom:12}}>
                <div style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>ล่าสุด</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:40,height:40,borderRadius:10,background:'#eff6ff',border:'2px solid #3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>
                    {latestResult.school.slice(0,2)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{latestResult.school}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{subjectIcon[latestResult.subject]} {latestResult.subject} · {latestResult.year}</div>
                  </div>
                  <div style={{fontSize:20,fontWeight:700,color:latestResult.pct>=70?'var(--green)':'var(--red)',flexShrink:0}}>{latestResult.pct}%</div>
                </div>
                <button onClick={()=>setScreen('result')} style={{marginTop:8,width:'100%',padding:'7px',borderRadius:8,border:'1px solid var(--border)',background:'#f8fafc',color:'var(--muted)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>ดูเฉลยอีกครั้ง</button>
              </div>
            )}

            {isParent&&(
              <div style={{background:'var(--green-light)',border:'1px solid #86efac',borderRadius:14,padding:'14px',marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--green-dark)',marginBottom:10}}>🔓 จัดการระบบ</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {l:'ดูผลทั้งหมด',i:'📊',fn:()=>setScreen('progress')},
                    {l:'ตั้งชื่อ/รูปลูก',i:'👶',fn:()=>{
                      const n=prompt('ชื่อลูก:',childName)
                      if(n) setChildName(n)
                      const a=prompt('URL รูปลูก (ถ้ามี):',childAvatar)
                      if(a!==null) setChildAvatar(a)
                    }},
                    {l:'Admin Page',i:'⚙️',fn:()=>window.open('/admin','_blank')},
                    {l:'Full Version',i:'⭐',fn:()=>setShowUpgrade(true)},
                  ].map(b=>(
                    <button key={b.l} onClick={b.fn} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 10px',borderRadius:10,border:'1px solid #86efac',background:'#fff',color:'var(--green-dark)',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:500,textAlign:'left'}}>
                      {b.i} {b.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isFull&&(
              <button onClick={()=>setShowUpgrade(true)} className="btn btn-full" style={{background:'var(--gold-light)',color:'#78350f',border:'2px solid #fcd34d',fontSize:14,fontWeight:700,borderRadius:14}}>
                ⭐ สมัคร Full Version — ปลดล็อกทุกฟีเจอร์
              </button>
            )}
          </div>
        )}

        {/* ── EXAM PICK ── */}
        {screen==='pick'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:'1px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:'var(--text)'}}>เลือกข้อสอบ</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>โรงเรียนดัง กทม. · 4 วิชา</div>
              </div>
            </div>

            {/* Year */}
            <div style={{display:'flex',gap:7,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
              {['2564','2565','2566','2567'].map(y=>(
                <button key={y} onClick={()=>setSelYear(y)} style={{flexShrink:0,padding:'6px 14px',borderRadius:20,border:`1.5px solid ${selYear===y?'var(--navy)':'var(--border)'}`,background:selYear===y?'var(--navy)':'#fff',color:selYear===y?'#fff':'var(--muted)',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:selYear===y?600:400}}>
                  ปี {y}
                </button>
              ))}
            </div>

            {/* Subject */}
            <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:8,letterSpacing:'.05em'}}>วิชา</div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:16}}>
              {SUBJECTS.map(s=>(
                <button key={s} onClick={()=>setSelSubject(s)} style={{padding:'7px 14px',borderRadius:20,border:`1.5px solid ${selSubject===s?'var(--navy)':'var(--border)'}`,background:selSubject===s?'var(--navy)':'#fff',color:selSubject===s?'#fff':'var(--muted)',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:selSubject===s?600:400}}>
                  {subjectIcon[s]} {s}
                </button>
              ))}
            </div>

            {/* Schools */}
            <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:8,letterSpacing:'.05em'}}>โรงเรียน</div>
            <div style={{display:'flex',flexDirection:'column',gap:9,marginBottom:20}}>
              {SCHOOLS.map((sch,i)=>{
                const locked = !isFull && i >= TRIAL_SCHOOLS
                const sel    = selSchool===sch
                return (
                  <div key={sch} onClick={()=>{ if(locked){setShowUpgrade(true);return}; setSelSchool(sch) }}
                    style={{background:sel?'#eff6ff':'#fff',border:`2px solid ${sel?'#3b82f6':'var(--border)'}`,borderRadius:14,padding:'12px 14px',cursor:locked?'default':'pointer',opacity:locked?.6:1,display:'flex',alignItems:'center',justifyContent:'space-between',transition:'border-color .15s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:34,height:34,borderRadius:9,background:'#eff6ff',border:'2px solid #3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>
                        {sch.slice(0,2)}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{sch}</div>
                        <div style={{fontSize:11,color:'var(--muted)'}}>{i<2?'รัฐบาล':'สาธิต/พิเศษ'}</div>
                      </div>
                    </div>
                    {locked?<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,background:'var(--gold-light)',color:'#92400e',border:'1px solid #fcd34d',fontWeight:600}}>⭐Full</span>
                           :<div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${sel?'#3b82f6':'var(--border)'}`,background:sel?'#3b82f6':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>{sel&&<div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}</div>
                    }
                  </div>
                )
              })}
            </div>

            <div style={{position:'sticky',bottom:72}}>
              <button onClick={loadExam} disabled={!selSchool||loading} className="btn btn-full btn-primary" style={{borderRadius:14,padding:15,fontSize:15}}>
                {loading?<><span className="spin">⟳</span> กำลังโหลด...</>
                  :selSchool?`เริ่ม — ${selSchool} · ${subjectIcon[selSubject]} ${selSubject}`:'เลือกโรงเรียน'}
              </button>
              {loadErr&&<div style={{fontSize:12,color:'var(--red)',textAlign:'center',marginTop:6}}>{loadErr}</div>}
              {!isFull&&<div style={{fontSize:11,color:'var(--muted)',textAlign:'center',marginTop:6}}>ทดลองใช้: {examCount}/{TRIAL_LIMIT} ชุด</div>}
            </div>
          </div>
        )}

        {/* ── EXAM DO ── */}
        {screen==='exam'&&questions.length>0&&(
          <div>
            <div className="card" style={{marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{selSchool} · {subjectIcon[selSubject]} {selSubject}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>ตอบแล้ว {Object.keys(answers).length}/{questions.length} ข้อ</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:22,fontWeight:700,color:timeLeft<60?'var(--red)':'var(--green)',fontVariantNumeric:'tabular-nums'}}>{fmtSec(timeLeft)}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>เหลือเวลา</div>
              </div>
            </div>

            <div className="progress-bar" style={{marginBottom:14}}>
              <div className="progress-fill" style={{width:`${Object.keys(answers).length/questions.length*100}%`}}/>
            </div>

            {questions.map(q=>(
              <div key={q.id} className="card" style={{marginBottom:10,borderColor:answers[q.id]!==undefined?'var(--navy)':'var(--border)',transition:'border-color .15s'}}>
                <div style={{display:'flex',gap:8,marginBottom:11}}>
                  <div style={{width:24,height:24,borderRadius:7,background:answers[q.id]!==undefined?'var(--navy)':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:answers[q.id]!==undefined?'#fff':'var(--muted)',flexShrink:0}}>{q.id.slice(-2)}</div>
                  <div>
                    <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{q.level}</div>
                    <div style={{fontSize:14,fontWeight:500,color:'var(--text)',lineHeight:1.6}}>{q.text}</div>
                  </div>
                </div>
                <div className="opts-grid">
                  {q.opts.map((opt,oi)=>{
                    const sel=answers[q.id]===oi
                    return(
                      <button key={oi} onClick={()=>setAnswers(p=>({...p,[q.id]:oi}))}
                        style={{padding:'10px 12px',borderRadius:10,border:`2px solid ${sel?'var(--navy)':'var(--border)'}`,background:sel?'var(--navy)':'#fafafa',color:sel?'#fff':'var(--text)',fontSize:13,cursor:'pointer',fontFamily:'inherit',textAlign:'left',fontWeight:sel?600:400,transition:'all .12s'}}>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <button onClick={submitExam} disabled={Object.keys(answers).length<questions.length} className="btn btn-full" style={{marginTop:4,padding:15,borderRadius:14,fontSize:15,background:Object.keys(answers).length===questions.length?'var(--navy)':'#d1d5db',color:'#fff',boxShadow:Object.keys(answers).length===questions.length?'0 4px 14px rgba(30,41,59,.25)':'none'}}>
              ส่งคำตอบ ({Object.keys(answers).length}/{questions.length})
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {screen==='result'&&latestResult&&(
          <div>
            <div className="card" style={{textAlign:'center',marginBottom:14,padding:'22px 18px'}}>
              <div style={{fontSize:44,marginBottom:6}}>{latestResult.pct>=80?'🏆':latestResult.pct>=60?'👍':'💪'}</div>
              <div style={{fontSize:38,fontWeight:700,color:latestResult.pct>=70?'var(--green)':'var(--red)',marginBottom:4}}>{latestResult.pct}%</div>
              <div style={{fontSize:13,color:'var(--muted)',marginBottom:14}}>
                {latestResult.score}/{latestResult.total} ข้อ · {latestResult.school} · {subjectIcon[latestResult.subject]} {latestResult.subject}
              </div>
              <div className="progress-bar" style={{marginBottom:14,height:7}}>
                <div className="progress-fill" style={{width:`${latestResult.pct}%`,background:latestResult.pct>=70?'var(--green)':'var(--red)',transition:'width 1s ease'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {[{l:'ถูก',v:`${latestResult.score}`,c:'var(--green)'},{l:'ผิด',v:`${latestResult.total-latestResult.score}`,c:'var(--red)'},{l:'เวลา',v:fmtSec(latestResult.timeUsed),c:'#1d4ed8'}].map(s=>(
                  <div key={s.l} style={{background:'#f8fafc',borderRadius:10,padding:'10px 6px'}}>
                    <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:10}}>เฉลยละเอียด</div>
            {questions.map(q=>{
              const ua=answers[q.id]; const ok=ua===q.ans
              return(
                <div key={q.id} className="card" style={{marginBottom:9,borderColor:ok?'#86efac':'#fca5a5'}}>
                  <div style={{display:'flex',gap:7,marginBottom:8}}>
                    <div style={{width:22,height:22,borderRadius:6,background:ok?'var(--green-light)':'#fee2e2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{ok?'✓':'✗'}</div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--text)',lineHeight:1.55}}>{q.text}</div>
                  </div>
                  <div className="opts-grid" style={{marginBottom:9}}>
                    {q.opts.map((opt,oi)=>{
                      const isAns=oi===q.ans,isUser=oi===ua
                      return<div key={oi} style={{padding:'7px 9px',borderRadius:8,border:`1.5px solid ${isAns?'var(--green)':isUser&&!ok?'var(--red)':'var(--border)'}`,background:isAns?'var(--green-light)':isUser&&!ok?'#fee2e2':'#fafafa',fontSize:12,color:isAns?'var(--green-dark)':isUser&&!ok?'#991b1b':'var(--muted)',fontWeight:isAns?600:400}}>
                        {opt}{isAns?' ✓':''}{isUser&&!ok?' ✗':''}
                      </div>
                    })}
                  </div>
                  <div style={{background:'#f8fafc',borderRadius:8,padding:'8px 10px',fontSize:12,color:'var(--text)',lineHeight:1.6}}>💡 {q.explain}</div>
                </div>
              )
            })}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:14}}>
              <button onClick={()=>setScreen('pick')} className="btn btn-outline" style={{borderColor:'var(--navy)',color:'var(--navy)',borderWidth:2}}>ทำใหม่</button>
              <button onClick={()=>setScreen('home')} className="btn btn-primary">หน้าหลัก</button>
            </div>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {screen==='progress'&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <button onClick={()=>setScreen('home')} style={{width:34,height:34,borderRadius:10,border:'1px solid var(--border)',background:'#fff',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>←</button>
              <div style={{fontSize:17,fontWeight:700,color:'var(--text)'}}>ประวัติผลสอบ</div>
            </div>
            {!history.length?(
              <div style={{textAlign:'center',padding:'48px 20px',color:'var(--muted)'}}>
                <div style={{fontSize:40,marginBottom:10}}>📝</div>
                <div style={{fontSize:14}}>ยังไม่มีประวัติ</div>
                <button onClick={()=>setScreen('pick')} className="btn btn-primary" style={{marginTop:14}}>เริ่มทำข้อสอบ</button>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:9}}>
                {history.map(r=>(
                  <div key={r.id} className="card" style={{display:'flex',alignItems:'center',gap:11}}>
                    <div style={{width:42,height:42,borderRadius:11,background:'#eff6ff',border:'2px solid #3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>
                      {r.school.slice(0,2)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.school}</div>
                      <div style={{fontSize:11,color:'var(--muted)'}}>{subjectIcon[r.subject]} {r.subject} · {r.year} · {r.createdAt}</div>
                      <div className="progress-bar" style={{marginTop:5,height:3}}>
                        <div className="progress-fill" style={{width:`${r.pct}%`,background:r.pct>=70?'var(--green)':'var(--red)'}}/>
                      </div>
                    </div>
                    <div style={{fontSize:19,fontWeight:700,color:r.pct>=70?'var(--green)':'var(--red)',flexShrink:0}}>{r.pct}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* BOTTOM NAV */}
      {screen!=='exam'&&(
        <div className="bottomnav">
          {[
            {id:'home',icon:'🏠',label:'หลัก'},
            {id:'pick',icon:'📝',label:'ข้อสอบ'},
            {id:'progress',icon:'📊',label:'ผล'},
            {id:'upgrade',icon:'⭐',label:'Full'},
          ].map(item=>(
            <button key={item.id} onClick={()=>item.id==='upgrade'?setShowUpgrade(true):setScreen(item.id as Screen)} className={`nav-item${screen===item.id?' active':''}`}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
