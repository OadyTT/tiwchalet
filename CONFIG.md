# TiwChalet ติวฉลาด — CONFIG.md
> อัพเดตล่าสุด: v2.1.6 | April 2026

---

## 🌐 Live URLs

| ชื่อ | URL |
|------|-----|
| App หลัก | https://tiwchalet.vercel.app |
| Admin Page | https://tiwchalet.vercel.app/admin-tc2024 |
| Admin Secret Path | `/admin-[ADMIN_SECRET]` (default: `tc2024`) |

---

## 🔑 Credentials & PINs

| ชื่อ | ค่า | หมายเหตุ |
|------|-----|---------|
| `parent_pin` | `5678` | 4 หลักตัวเลข — กด numpad |
| `full_version_pin` | ตั้งใน Supabase | **6 หลักตัวเลข** — กด numpad |
| Admin LINE ID | `Oady` | |
| Admin Email | `thitiphankk@gmail.com` | |
| LINE Admin User ID | `Ub41fc0cdada0f290836a5b8258baccd1` | |

### เปลี่ยน full_version_pin (Supabase SQL Editor):
```sql
update settings set full_version_pin = '123456' where id = 1;
```

---

## 🗄️ Supabase

| Key | Value |
|-----|-------|
| Project Name | Project TiwChalet (ตัวอย่าด) |
| Project ID | `iulbptpqpsrjrxpfcwgp` |
| Project URL | `https://iulbptpqpsrjrxpfcwgp.supabase.co` |
| Region | Southeast Asia (Singapore) |

### Tables

| Table | คำอธิบาย | RLS |
|-------|---------|-----|
| `questions` | ข้อสอบทั้งหมด | select: all · write: service_role |
| `exam_results` | ผลสอบของนักเรียน | select+insert: all |
| `upgrade_requests` | คำขอ Full Version + สลิป | select+insert+update+delete: all |
| `settings` | ตั้งค่าระบบ (1 row) | select: all · write: service_role |
| `backup_logs` | log การ backup (1 row) | select: all · write: service_role |

### settings columns ที่สำคัญ
```
parent_pin           TEXT   — 4 หลักตัวเลข
full_version_pin     TEXT   — 6 หลักตัวเลข
full_version_days    INT    — จำนวนวัน (default 30)
full_version_price   TEXT   — ราคา (default '299')
full_version_enabled BOOL
qr_code_image_url    TEXT
child_name           TEXT
child_avatar_url     TEXT
child_target_school  TEXT
admin_phone          TEXT
admin_email          TEXT
admin_line_id        TEXT
```

### SQL แก้ RLS (ถ้ามีปัญหา approve ไม่ได้)
```sql
-- upgrade_requests — ต้องมีครบ 4 policies นี้
drop policy if exists "read_upgrade"   on upgrade_requests;
drop policy if exists "insert_upgrade" on upgrade_requests;
drop policy if exists "update_upgrade" on upgrade_requests;
drop policy if exists "delete_upgrade" on upgrade_requests;

create policy "read_upgrade"   on upgrade_requests for select using (true);
create policy "insert_upgrade" on upgrade_requests for insert with check (true);
create policy "update_upgrade" on upgrade_requests for update using (true) with check (true);
create policy "delete_upgrade" on upgrade_requests for delete using (true);
```

---

## ☁️ Vercel Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL       = https://iulbptpqpsrjrxpfcwgp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...
SUPABASE_SERVICE_ROLE_KEY      = eyJ...  ← ⚠️ ต้องมีตัวนี้ สำคัญมาก

# Google Apps Script
GAS_ENDPOINT    = https://script.google.com/macros/s/AKfycbwBzBhsbgcM4fg81dE4UCkvMXb7d-dxcECBJiHQNI2SykEmJmdbo0sYW6EYV-vQJJV3yw/exec
GOOGLE_SHEET_ID = 1qie4zYmIODwHZSVVWX3OUXC-qTfJwp_oGtJOdJceiOI

# LINE OA  ← ⚠️ Token เก่าถูก expose ต้อง revoke + สร้างใหม่
LINE_CHANNEL_TOKEN   = (token ใหม่จาก LINE Developers)
LINE_ADMIN_USER_ID   = Ub41fc0cdada0f290836a5b8258baccd1

# Admin
ADMIN_EMAIL    = thitiphankk@gmail.com
ADMIN_LINE_ID  = Oady
ADMIN_SECRET   = tc2024  ← เปลี่ยนได้ URL admin จะเป็น /admin-[ค่านี้]

# Cron (Vercel auto-backup)
CRON_SECRET    = tiwchalet-cron
```

---

## 📁 โครงสร้างไฟล์

```
src/
  app/
    page.tsx                ← Main app (3 modes: student/parent)
    layout.tsx
    globals.css
    admin/page.tsx          ← /admin → 404 (redirect by middleware)
    admin-tc2024/page.tsx   ← Admin page จริง (sync จาก admin/page.tsx)
    api/
      pin/route.ts          ← verify PIN (parent=4digit, full=6digit)
      questions/route.ts    ← GET questions + POST add + DELETE
      settings/route.ts     ← GET/PUT(admin full)/POST(update)
      save-result/route.ts  ← บันทึกผลสอบ
      upgrade-notify/route.ts
      approve/route.ts      ← admin approve/reject + LINE notify
      backup/route.ts       ← manual + auto (cron) backup → GAS
      upload-slip/route.ts  ← ผู้ปกครองส่งสลิป + LINE notify admin
      import-pdf/route.ts   ← v3: รับ text จาก client (ไม่ส่ง base64)
  lib/supabase.ts
  middleware.ts             ← /admin → 404, /admin-[wrong] → 404
  store/index.ts
  types/index.ts
```

---

## 🖥️ App Modes

### Student Mode (default)
- ทำข้อสอบ 4 วิชา × 6 โรงเรียน
- Trial: 2 โรงเรียนแรก, 10 ข้อ/ชุด
- Full: ทุกโรงเรียน ไม่จำกัดชุด
- ดูเฉลยละเอียด ประวัติผล

### Parent Mode (PIN 4 หลัก)
- Dashboard คะแนนแต่ละวิชา + กราฟ
- แก้ชื่อ/รูปนักเรียนได้เอง
- ปุ่ม Backup ไป Google Sheets
- เพิ่ม / ถอด Full Version
- ปุ่ม 🔒 ผู้ปกครอง มุมขวาบน topbar

### Admin Page `/admin-tc2024`
- **💰 อนุมัติ** — ดูสลิป, กด ✅ approve / ❌ reject → LINE แจ้ง admin + PIN
- **⚙️ ตั้งค่า** — แก้ PIN, ราคา, QR code, ข้อมูลติดต่อ
- **📄 นำเข้า PDF** — upload PDF → extract text client-side → parse → preview → import
- **📝 ข้อสอบ** — เพิ่มข้อสอบ, ดูรายการ
- **📊 สถิติ** — ผลสอบล่าสุด
- ปุ่ม 💾 Backup ที่ topbar

---

## 💳 Payment Flow

```
1. ลูกค้ากด ⭐ → เปรียบเทียบ trial/full → QR ธนาคาร
2. โอนเงิน → กรอกชื่อ/ติดต่อ/จำนวน → แนบสลิปรูปภาพ
3. POST /api/upload-slip → Supabase upgrade_requests + LINE push admin
4. Admin เปิด Admin Page แท็บ 💰 → เห็นสลิป → กด ✅ อนุมัติ
5. POST /api/approve → update DB + LINE แจ้ง admin พร้อม PIN 6 หลัก
6. Admin copy PIN → ส่งให้ลูกค้าทาง LINE เอง
7. ลูกค้ากด "มีรหัสแล้ว" → numpad 6 หลัก → Full Version ทันที
```

---

## 📄 PDF Import Flow

```
1. Admin เลือกโรงเรียน/วิชา/ปี → upload PDF
2. pdfjs-dist อ่าน text ใน browser (ไม่ส่ง base64 → ไม่ติด 4.5MB limit)
3. ส่งแค่ text ไป /api/import-pdf
4. Server parse ข้อสอบ + auto-detect วิชา (รองรับหลายวิชาในไฟล์เดียว)
5. แสดง preview แยกตามวิชา แก้ไขได้แต่ละข้อ/ทั้ง group
6. กด ✓ ยืนยัน → insert ลง Supabase ด้วย service_role
```

**PDF ที่รองรับ:** พิมพ์จากคอมพิวเตอร์ (text-selectable)
**PDF ที่ไม่รองรับ:** สแกนจากกระดาษ → แจ้ง user ให้กรอกเอง

**รูปแบบที่ parse ได้:**
```
วิชาคณิตศาสตร์
1. โจทย์...
ก. ตัวเลือก ก
ข. ตัวเลือก ข
ค. ตัวเลือก ค
ง. ตัวเลือก ง
เฉลย ข
```

---

## 💾 Backup

- **Auto**: Vercel Cron ทุกอาทิตย์ตี 2 (vercel.json)
- **Manual**: Admin กด 💾 ที่ topbar หรือ Parent กดใน Settings
- ส่งไป GAS → Google Sheet ID: `1qie4zYmIODwHZSVVWX3OUXC-qTfJwp_oGtJOdJceiOI`
- ทุก record มี `unique_key` (เช่น `result_abc123`) สำหรับ dedup ใน Sheets
- Auth: `x-admin-pin` header (parent PIN 4 หลัก) หรือ `x-cron-secret`

---

## 🔒 Security

| จุด | กลไก |
|-----|------|
| `/admin` URL | middleware → 404 |
| `/admin-[wrong]` | middleware → 404 |
| PIN brute force | Rate limit 5 ครั้ง/5 นาที + IP block 1 ชั่วโมงหลัง 10 ครั้ง |
| questions write | service_role key เท่านั้น ผ่าน API route |
| settings write | service_role key เท่านั้น + ตรวจ parent_pin |
| approve/backup | ตรวจ parent_pin ทุก request |

---

## 📦 Versions History

| Version | ไฟล์ | สิ่งที่เพิ่ม/แก้ |
|---------|------|----------------|
| v1.0.0 | tiwchalet-v1.0.0.tar.gz | Initial: Next.js + Supabase + GAS |
| v1.1.0 | tiwchalet-v1.1.0.tar.gz | Secret admin URL + PIN rate limit |
| v1.2.0 | tiwchalet-v1.2.0.tar.gz | PDF import (Claude API) |
| v2.0.0 | tiwchalet-v2.0.0.tar.gz | 3-mode app, payment flow, backup cron |
| v2.0.1 | tiwchalet-v2.0.1.tar.gz | Full PIN 5-char alphanumeric |
| v2.1.0 | tiwchalet-v2.1.0.tar.gz | Fix fullpin modal, backup PIN, font size 4 ระดับ, profile edit, trial 10 ข้อ |
| v2.1.1 | tiwchalet-v2.1.1.tar.gz | Fix RLS questions (ใช้ API route), static Q 10 ข้อ/วิชา |
| v2.1.2 | tiwchalet-v2.1.2.tar.gz | Fix approve RLS (update_upgrade policy) |
| v2.1.3 | tiwchalet-v2.1.3.tar.gz | PDF import ไม่ใช้ Anthropic API → pdf-parse |
| v2.1.4 | tiwchalet-v2.1.4.tar.gz | PDF import รองรับหลายวิชาในไฟล์เดียว |
| v2.1.5 | tiwchalet-v2.1.5.tar.gz | Fix 413 Too Large → extract text client-side (pdfjs-dist) |
| **v2.1.6** | tiwchalet-v2.1.6.tar.gz | **Full PIN 6 หลักตัวเลข, admin URL จาก env var** |

---

## 🚀 Deploy Commands

```cmd
cd D:\TiwChalet
git add .
git commit -m "v2.1.6 ..."
git push
```
Vercel auto-deploy หลัง push ทุกครั้ง (~3 นาที)

---

## ⚠️ Pending / Known Issues

- [ ] LINE_CHANNEL_TOKEN เดิมถูก expose ในแชท → **ต้อง revoke + สร้างใหม่**
- [ ] ข้อสอบ static fallback ไม่ใช่ข้อสอบจริง → ต้อง import PDF จากแหล่งจริง
- [ ] LINE OA ยังไม่ส่งหาลูกค้าอัตโนมัติหลัง approve → admin ส่ง PIN เองทาง LINE
- [ ] admin-tc2024/page.tsx ต้อง sync จาก admin/page.tsx ด้วยตนเองทุกครั้ง

---

## 📚 แหล่งข้อสอบจริง

| แหล่ง | URL | หมายเหตุ |
|-------|-----|---------|
| FindUsTutor | findustutor.com/tests/m1 | รวมข้อสอบจริง สวนกุหลาบ สามเสน บดินทรเดชา หอวัง |
| ครูตุ่ย | krutui.com | สวนกุหลาบ ปี 2567 |
| Facebook | "ติวเข้า ม.1 สวนกุหลาบ" | แชร์ PDF ฟรีบ่อย |
| Google | `ข้อสอบเข้า ม.1 [โรงเรียน] [ปี] filetype:pdf` | |
