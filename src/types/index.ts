// v1.0.0 — TiwChalet types

export type Plan = 'trial' | 'full'
export type Subject = 'คณิตศาสตร์' | 'วิทยาศาสตร์' | 'ภาษาไทย' | 'English'

export interface ChildProfile {
  id: string
  name: string
  avatarUrl?: string
  targetSchool?: string
}

export interface Question {
  id: string
  school: string
  year: string
  subject: Subject
  level: 'ง่าย' | 'ปานกลาง' | 'ยาก' | 'ยากมาก'
  text: string
  opts: [string, string, string, string]
  ans: number // 0–3
  explain: string
  createdAt?: string
}

export interface ExamSession {
  id: string
  questions: Question[]
  answers: Record<string, number> // questionId → answerIndex
  school: string
  subject: Subject
  year: string
  startedAt: string
  submittedAt?: string
  score?: number
  timeUsed?: number
}

export interface AppSettings {
  parentPin: string
  fullVersionPin: string
  fullVersionDays: number
  fullVersionPrice: string
  fullVersionEnabled: boolean
  qrCodeImageUrl: string
  childName: string
  childAvatarUrl: string
  childTargetSchool: string
  adminPhone: string
  adminEmail: string
  adminLineId: string
}

export interface UpgradeRequest {
  id: string
  name: string
  contact: string
  note?: string
  createdAt: string
  status: 'pending' | 'confirmed' | 'rejected'
}

export interface ExamResult {
  id: string
  school: string
  subject: Subject
  year: string
  score: number
  total: number
  pct: number
  timeUsed: number
  plan: Plan
  createdAt: string
}
