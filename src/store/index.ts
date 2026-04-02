import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Plan, ExamSession, ExamResult, AppSettings } from '@/types'

interface AppStore {
  // Auth
  plan: Plan
  isParent: boolean
  sessionToken: string | null
  fullVersionExpiry: string | null  // ISO date string

  // Settings (loaded from Supabase)
  settings: AppSettings | null

  // Exam
  activeSession: ExamSession | null
  examHistory: ExamResult[]
  trialExamCount: number

  // Actions
  setParent: (token: string) => void
  lockParent: () => void
  setFull: (expiryDays: number) => void
  setTrial: () => void
  setSettings: (s: AppSettings) => void
  setActiveSession: (s: ExamSession | null) => void
  addResult: (r: ExamResult) => void
  incTrialCount: () => void
  clearHistory: () => void
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      plan: 'trial',
      isParent: false,
      sessionToken: null,
      fullVersionExpiry: null,
      settings: null,
      activeSession: null,
      examHistory: [],
      trialExamCount: 0,

      setParent: (token) => set({ isParent: true, sessionToken: token }),
      lockParent: () => set({ isParent: false, sessionToken: null }),

      setFull: (days) => {
        const expiry = new Date()
        expiry.setDate(expiry.getDate() + days)
        set({ plan: 'full', fullVersionExpiry: expiry.toISOString() })
      },
      setTrial: () => set({ plan: 'trial', fullVersionExpiry: null }),

      setSettings: (s) => set({ settings: s }),
      setActiveSession: (s) => set({ activeSession: s }),

      addResult: (r) => set((state) => ({
        examHistory: [r, ...state.examHistory].slice(0, 50)
      })),
      incTrialCount: () => set((state) => ({ trialExamCount: state.trialExamCount + 1 })),
      clearHistory: () => set({ examHistory: [], trialExamCount: 0 }),
    }),
    {
      name: 'tiwchalet-v1',
      partialState: ['plan', 'fullVersionExpiry', 'examHistory', 'trialExamCount'],
    } as any
  )
)

// Helper: เช็ควันหมดอายุ full version
export function isFullActive(expiry: string | null): boolean {
  if (!expiry) return false
  return new Date(expiry) > new Date()
}

export function daysRemaining(expiry: string | null): number {
  if (!expiry) return 0
  const diff = new Date(expiry).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}
