// Dynamic admin route — รองรับ /admin-[secret] ใดก็ได้
// Middleware จะ validate secret ก่อน ถ้าผ่านค่อย render page นี้
// ถ้าไม่ผ่าน middleware redirect ไป 404 แล้ว

import AdminPageContent from '../admin/page'

export default function DynamicAdminPage() {
  return <AdminPageContent />
}
