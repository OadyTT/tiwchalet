-- ════════════════════════════════════════════════════════
--  TiwChalet v2.0 — SQL เพิ่มเติม
--  รัน 1 ครั้งใน Supabase SQL Editor
--  (table เดิมจาก v1 ยังใช้ได้ ไม่ต้องลบ)
-- ════════════════════════════════════════════════════════

-- 1. เพิ่ม columns ใน upgrade_requests (ถ้ายังไม่มี)
alter table upgrade_requests
  add column if not exists slip_image  text    default '',
  add column if not exists amount      text    default '',
  add column if not exists approved_at timestamptz;

-- 2. backup_logs table (สำหรับ track backup)
create table if not exists backup_logs (
  id              integer primary key default 1,
  last_backup     timestamptz,
  rows_results    integer default 0,
  rows_upgrades   integer default 0,
  rows_questions  integer default 0,
  gas_ok          boolean default false,
  note            text    default '',
  check (id = 1)
);
insert into backup_logs(id) values(1) on conflict do nothing;

-- 3. RLS สำหรับ backup_logs (service role เข้าถึงได้)
alter table backup_logs enable row level security;
create policy "read backup_logs"    on backup_logs for select using (true);
create policy "service backup_logs" on backup_logs for all    using (auth.role() = 'service_role');

-- 4. อัพเดต settings — เพิ่ม full_version_days ถ้ายังไม่มี
alter table settings
  add column if not exists full_version_days integer default 30;

-- ตรวจสอบว่ามีข้อมูลหรือเปล่า
select
  parent_pin,
  full_version_pin,
  full_version_days,
  full_version_price,
  child_name,
  admin_phone,
  admin_email,
  admin_line_id
from settings where id = 1;
