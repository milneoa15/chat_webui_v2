import { api, type SessionRead } from '@/api/client'
import { create } from 'zustand'

type SessionsState = {
  sessions: SessionRead[]
  status: 'idle' | 'loading' | 'error'
  error?: string
  selectedSessionId?: number
  lastUpdated?: number
  refresh: () => Promise<void>
  createSession: (title?: string) => Promise<SessionRead>
  selectSession: (sessionId: number) => void
}

const extractError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  status: 'idle',
  error: undefined,
  selectedSessionId: undefined,
  async refresh() {
    set({ status: 'loading', error: undefined })
    try {
      const response = await api.sessions.list()
      const nextSessions = response.items ?? []
      set((state) => ({
        sessions: nextSessions,
        status: 'idle',
        lastUpdated: Date.now(),
        selectedSessionId: state.selectedSessionId ?? nextSessions[0]?.id,
      }))
    } catch (error) {
      set({
        status: 'error',
        error: extractError(error, 'Unable to load sessions'),
      })
    }
  },
  async createSession(title) {
    const payload = title ? { title } : {}
    try {
      const created = await api.sessions.create(payload)
      set((state) => ({
        sessions: [created, ...state.sessions],
        selectedSessionId: created.id,
        lastUpdated: Date.now(),
      }))
      return created
    } catch (error) {
      const message = extractError(error, 'Unable to create session')
      set({ error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  selectSession(sessionId) {
    if (get().selectedSessionId === sessionId) {
      return
    }
    set({ selectedSessionId: sessionId })
  },
}))
