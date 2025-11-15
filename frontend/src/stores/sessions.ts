import { api, type SessionMetricsResponse, type SessionRead } from '@/api/client'
import { create } from 'zustand'

type SessionsState = {
  sessions: SessionRead[]
  status: 'idle' | 'loading' | 'error'
  error?: string
  selectedSessionId?: number
  lastUpdated?: number
  metrics: Record<number, SessionMetricsResponse>
  refresh: () => Promise<void>
  createSession: (title?: string) => Promise<SessionRead>
  selectSession: (sessionId: number) => void
  renameSession: (sessionId: number, title: string) => Promise<SessionRead>
  deleteSession: (sessionId: number) => Promise<void>
  loadMetrics: (sessionId: number, force?: boolean) => Promise<SessionMetricsResponse | undefined>
}

const extractError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  status: 'idle',
  error: undefined,
  selectedSessionId: undefined,
  metrics: {},
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
      void Promise.all(nextSessions.slice(0, 12).map((session) => get().loadMetrics(session.id))).catch(() => {
        /* hydration failures handled per-session */
      })
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
      void get().loadMetrics(created.id, true)
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
    void get().loadMetrics(sessionId)
  },
  async renameSession(sessionId, title) {
    try {
      const updated = await api.sessions.rename(sessionId, { title })
      set((state) => ({
        sessions: state.sessions.map((session) => (session.id === sessionId ? updated : session)),
        lastUpdated: Date.now(),
      }))
      return updated
    } catch (error) {
      const message = extractError(error, 'Unable to rename session')
      set({ error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  async deleteSession(sessionId) {
    try {
      await api.sessions.delete(sessionId)
      set((state) => {
        const filtered = state.sessions.filter((session) => session.id !== sessionId)
        const nextSelected = state.selectedSessionId === sessionId ? filtered[0]?.id : state.selectedSessionId
        const metrics = { ...state.metrics }
        delete metrics[sessionId]
        return {
          sessions: filtered,
          selectedSessionId: nextSelected,
          metrics,
          lastUpdated: Date.now(),
        }
      })
    } catch (error) {
      const message = extractError(error, 'Unable to delete session')
      set({ error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  },
  async loadMetrics(sessionId, force = false) {
    const existing = get().metrics[sessionId]
    if (existing && !force) {
      return existing
    }
    try {
      const metrics = await api.sessions.metrics(sessionId)
      set((state) => ({
        metrics: {
          ...state.metrics,
          [sessionId]: metrics,
        },
      }))
      return metrics
    } catch (error) {
      console.warn('Unable to load metrics for session', sessionId, error)
      return undefined
    }
  },
}))
