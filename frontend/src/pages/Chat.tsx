import { Sparkles } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import type { HealthResponse } from '@/api/client'
import { useSessionsStore } from '@/stores/sessions'

type OutletContext = {
  health?: HealthResponse
}

export function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { health } = useOutletContext<OutletContext>()
  const { sessions, status, selectedSessionId, refresh, createSession, selectSession } = useSessionsStore()

  useEffect(() => {
    if (!sessions.length && status === 'idle') {
      void refresh()
    }
  }, [sessions.length, status, refresh])

  useEffect(() => {
    if (sessionId) {
      selectSession(Number(sessionId))
    }
  }, [sessionId, selectSession])

  const handleCreateSession = async () => {
    try {
      const created = await createSession()
      navigate(`/chat/${created.id}`)
    } catch (error) {
      console.error('Failed to create session', error)
    }
  }

  const healthCards = [
    { label: 'Database', value: health?.db_status ?? 'checking' },
    { label: 'Ollama', value: health?.ollama_status ?? 'checking' },
    { label: 'Scheduler', value: health?.scheduler_status ?? 'checking' },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      <aside className="space-y-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-4">
        <button
          onClick={handleCreateSession}
          className="flex w-full items-center justify-center rounded-xl border border-transparent bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          New Session
        </button>
        <div className="space-y-2">
          {status === 'loading' && <p className="text-sm text-[color:var(--text-muted)]">Loading sessions…</p>}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => navigate(`/chat/${session.id}`)}
              className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition ${
                selectedSessionId === session.id
                  ? 'border-[color:var(--accent-primary)] bg-[color:var(--surface-muted)] text-[color:var(--text-primary)]'
                  : 'border-transparent text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]'
              }`}
            >
              <span className="text-sm font-semibold">{session.title}</span>
              <span className="text-xs uppercase tracking-[0.25em]">{new Date(session.updated_at).toLocaleDateString()}</span>
            </button>
          ))}
          {!sessions.length && status === 'idle' && (
            <p className="text-sm text-[color:var(--text-muted)]">Create your first session to begin chatting.</p>
          )}
        </div>
      </aside>

      <section className="space-y-6 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Session diagnostics</p>
            <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">
              {sessions.find((session) => session.id === selectedSessionId)?.title ?? 'No session selected'}
            </h2>
          </div>
          <button
            onClick={() => {
              void refresh()
            }}
            className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-panel)]"
          >
            Refresh Sessions
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {healthCards.map((card) => (
            <article key={card.label} className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--text-muted)]">{card.label}</p>
              <p className="mt-2 text-lg font-semibold capitalize text-[color:var(--text-primary)]">{card.value}</p>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6 text-center">
          <Sparkles className="mx-auto size-12 text-[color:var(--text-muted)]" />
          <p className="mt-4 text-lg font-medium text-[color:var(--text-primary)]">
            Chat streaming arrives in Phase 7. Sessions persist now so you can focus on model orchestration next.
          </p>
        </div>
      </section>
    </div>
  )
}
