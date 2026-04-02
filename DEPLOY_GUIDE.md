# ติวฉลาด — คู่มือ Deploy v1.0.0
ใช้เวลา 30–45 นาที · ไม่ต้องเขียนโปรแกรม

---

## ภาพรวมระบบ

```
ผู้ใช้ (มือถือ/tablet/laptop)
         ↓
 [Vercel — Next.js] ← web app (ฟรี)
    ↓          ↓
[Supabase]  [Google Apps Script]
ข้อสอบ/ผล   backup → Google Sheets
settings    LINE OA notify
leads
```

---

## STEP 1 — สร้าง Supabase (5 นาที)

1. ไปที่ **supabase.com** → Sign up ด้วย Google
2. **New Project** → ชื่อ `tiwchalet` → ใส่ password → Region: **Southeast Asia (Singapore)**
3. รอ ~2 นาที

### รัน SQL (ทำครั้งเดียว)
4. ไปที่ **SQL Editor** → **New query** → วาง SQL ด้านล่าง → กด **Run**

```sql
create table if not exists questions (
  id text primary key default gen_random_uuid()::text,
  school text not null, year text not null,
  subject text not null, level text not null default 'ปานกลาง',
  text text not null,
  opt_a text not null, opt_b text not null, opt_c text not null, opt_d text not null,
  ans integer not null default 0, explain text default '',
  source text default 'manual', created_at timestamptz default now()
);
create index if not exists idx_q on questions(school, subject, year);

create table if not exists exam_results (
  id text primary key default gen_random_uuid()::text,
  school text, subject text, year text,
  score integer, total integer, pct integer,
  time_used integer, plan text default 'trial',
  created_at timestamptz default now()
);

create table if not exists upgrade_requests (
  id text primary key default gen_random_uuid()::text,
  name text, contact text, note text,
  status text default 'pending', created_at timestamptz default now()
);

create table if not exists settings (
  id integer primary key default 1,
  parent_pin text default '1234',
  full_version_pin text default '9999',
  full_version_days integer default 30,
  full_version_price text default '299',
  full_version_enabled boolean default true,
  qr_code_image_url text default '',
  child_name text default 'น้องมิ้น',
  child_avatar_url text default '',
  child_target_school text default 'สาธิตจุฬา',
  admin_phone text default '0XX-XXX-XXXX',
  admin_email text default 'thitiphankk@gmail.com',
  admin_line_id text default 'Oady',
  check (id = 1)
);
insert into settings(id) values(1) on conflict do nothing;

alter table settings         enable row level security;
alter table questions        enable row level security;
alter table exam_results     enable row level security;
alter table upgrade_requests enable row level security;

create policy "pub read settings"  on settings         for select using (true);
create policy "pub read questions" on questions        for select using (true);
create policy "pub insert results" on exam_results     for insert with check (true);
create policy "pub read results"   on exam_results     for select using (true);
create policy "pub insert upgrade" on upgrade_requests for insert with check (true);
create policy "pub read upgrade"   on upgrade_requests for select using (true);
create policy "svc settings"  on settings         for all using (auth.role()='service_role');
create policy "svc questions" on questions        for all using (auth.role()='service_role');
create policy "svc results"   on exam_results     for all using (auth.role()='service_role');
create policy "svc upgrade"   on upgrade_requests for all using (auth.role()='service_role');
```

### คัดลอก API Keys
5. **Project Settings** → **API** → คัดลอก:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## STEP 2 — LINE Channel Token ใหม่ (5 นาที)

> ⚠️ Token เก่าที่เคยแชร์ไว้ให้ revoke ก่อน

1. **developers.line.biz** → Log in → เลือก Channel
2. **Messaging API** → **Channel access token** → **Issue** (สร้างใหม่)
3. คัดลอก → ใส่ใน `LINE_CHANNEL_TOKEN`

---

## STEP 3 — Deploy Vercel (15 นาที)

### 3.1 Upload โค้ดไป GitHub
1. **github.com** → New repository → ชื่อ `tiwchalet` → **Private**
2. ใน repository → **uploading an existing file**
3. ลากโฟลเดอร์ `tiwchalet` ทิ้งลงไป → **Commit changes**

### 3.2 Deploy
4. **vercel.com** → Log in ด้วย GitHub
5. **Add New Project** → เลือก `tiwchalet`
6. Framework preset: **Next.js** (auto)
7. คลิก **Environment Variables** → เพิ่มทีละอัน:

```
NEXT_PUBLIC_SUPABASE_URL      = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
SUPABASE_SERVICE_ROLE_KEY     = eyJ...
GAS_ENDPOINT                  = https://script.google.com/macros/s/AKfycbwBzBhsbgcM4fg81dE4UCkvMXb7d-dxcECBJiHQNI2SykEmJmdbo0sYW6EYV-vQJJV3yw/exec
GOOGLE_SHEET_ID               = 1qie4zYmIODwHZSVVWX3OUXC-qTfJwp_oGtJOdJceiOI
LINE_CHANNEL_TOKEN            = (token ใหม่จาก STEP 2)
LINE_ADMIN_USER_ID            = Ub41fc0cdada0f290836a5b8258baccd1
ADMIN_EMAIL                   = thitiphankk@gmail.com
ADMIN_LINE_ID                 = Oady
```

8. **Deploy** → รอ ~3 นาที → ได้ URL เช่น `https://tiwchalet.vercel.app`

---

## STEP 4 — ตั้งค่าครั้งแรก (5 นาที)

1. เปิด `https://YOUR-APP.vercel.app/admin`
2. PIN: **1234**
3. ตั้งค่า:
   - ชื่อลูก / รูปโปรไฟล์
   - PIN ผู้ปกครอง (เปลี่ยนจาก 1234)
   - PIN Full Version (ส่งให้ลูกค้าหลังจ่าย เช่น 5678)
   - ราคา / จำนวนวัน
   - อัพโหลด QR Code ธนาคาร
   - เบอร์โทร / LINE / Email
4. **บันทึก**

---

## STEP 5 — ทดสอบ (5 นาที)

- [ ] เปิด app → ทำข้อสอบ 1 ชุด → ดูผล
- [ ] กด Full Version → ดู QR + ราคา
- [ ] กด ผู้ปกครอง → ใส่ PIN → เข้าได้
- [ ] Supabase → Tables → `exam_results` → มีข้อมูล
- [ ] Google Sheets → มีข้อมูล sync

---

## การขาย Full Version

| ขั้นตอน | รายละเอียด |
|--------|-----------|
| ลูกค้าสแกน QR | จากหน้า Full Version ในแอป |
| ส่งสลิป | LINE: Oady หรือ Email: thitiphankk@gmail.com |
| Admin ตรวจสลิป | ใน Supabase → upgrade_requests |
| ส่ง PIN | ส่ง `full_version_pin` ให้ลูกค้า |
| ลูกค้าใส่ PIN | กด Full → ใส่รหัส → ใช้งานได้ |

---

## อัพเดตระบบในอนาคต

แก้ไขโค้ด → push GitHub → Vercel deploy อัตโนมัติ ภายใน 3 นาที

---

## ปัญหาที่พบบ่อย

| ปัญหา | แก้ไข |
|------|------|
| ทำข้อสอบ error | Vercel → Logs → ดู error |
| ผลไม่บันทึก Supabase | ตรวจ SUPABASE_SERVICE_ROLE_KEY |
| LINE ไม่แจ้ง | ตรวจ LINE_CHANNEL_TOKEN ต้องเป็น token ใหม่ |
| PIN เข้าไม่ได้ | ไป /admin → ดู parent_pin ใน Supabase settings |

*LINE: Oady · Email: thitiphankk@gmail.com*
