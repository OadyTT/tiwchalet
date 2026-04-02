import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

// Service-role client สำหรับ API routes เท่านั้น
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/*
── SQL สำหรับรัน 1 ครั้งใน Supabase SQL Editor ──────────────────

-- 1. ตารางข้อสอบ
create table if not exists questions (
  id          text primary key default gen_random_uuid()::text,
  school      text not null,
  year        text not null,
  subject     text not null,
  level       text not null default 'ปานกลาง',
  text        text not null,
  opt_a       text not null,
  opt_b       text not null,
  opt_c       text not null,
  opt_d       text not null,
  ans         integer not null default 0,
  explain     text default '',
  source      text default 'manual',
  created_at  timestamptz default now()
);
create index on questions(school, subject, year);

-- 2. ผลสอบ
create table if not exists exam_results (
  id          text primary key default gen_random_uuid()::text,
  school      text,
  subject     text,
  year        text,
  score       integer,
  total       integer,
  pct         integer,
  time_used   integer,
  plan        text default 'trial',
  created_at  timestamptz default now()
);

-- 3. คำขอ upgrade
create table if not exists upgrade_requests (
  id          text primary key default gen_random_uuid()::text,
  name        text,
  contact     text,
  note        text,
  status      text default 'pending',
  created_at  timestamptz default now()
);

-- 4. settings (1 row เท่านั้น)
create table if not exists settings (
  id                    integer primary key default 1,
  parent_pin            text    default '1234',
  full_version_pin      text    default '9999',
  full_version_days     integer default 30,
  full_version_price    text    default '299',
  full_version_enabled  boolean default true,
  qr_code_image_url     text    default '',
  child_name            text    default 'น้องมิ้น',
  child_avatar_url      text    default '',
  child_target_school   text    default 'สาธิตจุฬา',
  admin_phone           text    default '0XX-XXX-XXXX',
  admin_email           text    default 'thitiphankk@gmail.com',
  admin_line_id         text    default 'Oady',
  check (id = 1)
);
insert into settings(id) values(1) on conflict do nothing;

-- 5. RLS: ปิด public write สำหรับ settings
alter table settings enable row level security;
create policy "read settings" on settings for select using (true);
create policy "service only write" on settings for all using (auth.role() = 'service_role');

-- 6. questions อ่านได้ทุกคน เขียนได้แค่ service
alter table questions enable row level security;
create policy "read questions" on questions for select using (true);
create policy "service write questions" on questions for all using (auth.role() = 'service_role');
*/
