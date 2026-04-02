import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ติวฉลาด — TiwChalet v1.0',
  description: 'ระบบติวเข้า ม.1 สำหรับครอบครัว · ข้อสอบโรงเรียนดังกรุงเทพ',
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#1e293b',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      </head>
      <body>{children}</body>
    </html>
  )
}
