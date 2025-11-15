import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, MoreHorizontal, Search } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import type { SessionMetricsResponse, SessionRead } from '@/api/client'

export type ChatSidebarProps = {
  sessions: SessionRead[]
  metrics: Record<number, SessionMetricsResponse>
  selectedSessionId?: number
  status: 'idle' | 'loading' | 'error'
  error?: string
  onSelect: (sessionId: number) => void
  onCreate: () => void
  onRefresh: () => void
  onRenameRequest: (session: SessionRead) => void
  onDeleteRequest: (session: SessionRead) => void
}

export function ChatSidebar({
  sessions,
  metrics,
  selectedSessionId,
  status,
  error,
  onSelect,
  onCreate,
  onRefresh,
  onRenameRequest,
  onDeleteRequest,
}: ChatSidebarProps) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!sessions.length) return
      if (!event.altKey) return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const currentIndex = sessions.findIndex((session) => session.id === selectedSessionId)
      if (event.key === 'ArrowDown') {
        const next = sessions[(currentIndex + 1) % sessions.length]
        if (next) onSelect(next.id)
      } else if (event.key === 'ArrowUp') {
        const prevIndex = currentIndex <= 0 ? sessions.length - 1 : currentIndex - 1
        const prev = sessions[prevIndex]
        if (prev) onSelect(prev.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sessions, selectedSessionId, onSelect])

  const filteredSessions = useMemo(() => {
    if (!query.trim()) return sessions
    const lower = query.toLowerCase()
    return sessions.filter((session) => session.title.toLowerCase().includes(lower))
  }, [sessions, query])

  return (
    <aside className="flex h-full flex-col gap-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onCreate}
          className="flex-1 rounded-xl border border-transparent bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          New Session
        </button>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-[color:var(--border-strong)] px-3 py-2 text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]"
        >
          Sync
        </button>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-muted)]">
        <Search className="size-4" />
        <input
          className="flex-1 border-none bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
          placeholder="Search sessions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="text-xs text-[color:var(--text-muted)]">Alt + ↑/↓ to cycle sessions</p>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {status === 'loading' && <p className="text-sm text-[color:var(--text-muted)]">Loading sessions…</p>}
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-100">{error}</p>}
        {filteredSessions.map((session) => {
          const sessionMetrics = metrics[session.id]
          const tokenCount = (sessionMetrics?.total_prompt_tokens ?? 0) + (sessionMetrics?.total_completion_tokens ?? 0)
          return (
            <div
              key={session.id}
              className={clsx(
                'group flex items-center gap-3 rounded-xl border px-3 py-3 transition',
                selectedSessionId === session.id
                  ? 'border-[color:var(--accent-primary)] bg-[color:var(--surface-muted)]'
                  : 'border-transparent hover:border-[color:var(--border-strong)]',
              )}
            >
              <button className="flex-1 text-left" onClick={() => onSelect(session.id)}>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{session.title}</p>
                <p className="text-xs text-[color:var(--text-muted)]">
                  <CalendarDays className="mr-1 inline size-3" />
                  {new Date(session.updated_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-xs text-[color:var(--text-muted)]">
                  {tokenCount > 0 ? `${tokenCount} tokens` : 'No tokens yet'} · {sessionMetrics?.total_messages ?? 0} messages
                </p>
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="rounded-full border border-transparent p-2 text-[color:var(--text-muted)] opacity-0 transition hover:border-[color:var(--border-strong)] group-hover:opacity-100">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Session actions</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="z-20 min-w-[160px] rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-2 text-sm text-[color:var(--text-primary)] shadow-xl">
                    <DropdownMenu.Item
                      className="cursor-pointer rounded-lg px-3 py-2 hover:bg-[color:var(--surface-panel)]"
                      onSelect={(event) => {
                        event.preventDefault()
                        onRenameRequest(session)
                      }}
                    >
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="cursor-pointer rounded-lg px-3 py-2 text-red-300 hover:bg-red-500/10"
                      onSelect={(event) => {
                        event.preventDefault()
                        onDeleteRequest(session)
                      }}
                    >
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          )
        })}
        {!sessions.length && status === 'idle' && (
          <p className="text-sm text-[color:var(--text-muted)]">Create your first session to start chatting.</p>
        )}
      </div>
    </aside>
  )
}
