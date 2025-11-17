import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, MoreHorizontal, PanelLeftClose, Plus, RefreshCw, Search, CircleDot } from 'lucide-react'
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
  onCollapse?: () => void
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
  onCollapse,
}: ChatSidebarProps) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

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
    <aside className="flex h-full flex-col gap-4 bg-transparent px-3 py-4 text-sm text-[color:var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border-strong)] pb-2 text-[color:var(--accent-primary)]">
        <MessageSquare className="size-4" aria-hidden />
        {onCollapse && (
          <button
            className="inline-flex items-center justify-center text-[color:var(--text-muted)] transition hover:text-[color:var(--accent-primary)]"
            onClick={onCollapse}
          >
            <PanelLeftClose className="size-4" />
            <span className="sr-only">Collapse sessions</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCreate}
          className="flex size-8 items-center justify-center border border-[color:var(--accent-primary)] text-[color:var(--accent-primary)] hover:text-[color:var(--text-primary)]"
        >
          <Plus className="size-4" aria-hidden />
          <span className="sr-only">New session</span>
        </button>
        <button
          onClick={onRefresh}
          className="flex size-8 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)]"
        >
          <RefreshCw className="size-4" aria-hidden />
          <span className="sr-only">Sync sessions</span>
        </button>
        <button
          onClick={() => setSearchOpen((value) => !value)}
          className="flex size-8 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)]"
          aria-expanded={searchOpen}
        >
          <Search className="size-4" aria-hidden />
          <span className="sr-only">Search sessions</span>
        </button>
      </div>
      {searchOpen && (
        <div className="border-b border-[color:var(--border-strong)] pb-1">
          <input
            className="w-full border-none bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
            placeholder="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {status === 'loading' && <p className="text-sm text-[color:var(--text-muted)]">Loading sessions…</p>}
        {error && <p className="bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
        {filteredSessions.map((session) => {
          const sessionMetrics = metrics[session.id]
          const tokenCount = (sessionMetrics?.total_prompt_tokens ?? 0) + (sessionMetrics?.total_completion_tokens ?? 0)
          return (
            <div
              key={session.id}
              className={clsx(
                'group flex items-center gap-3 border-l-2 px-3 py-3 transition',
                selectedSessionId === session.id
                  ? 'border-[color:var(--accent-primary)] bg-[color:var(--surface-muted)]/40'
                  : 'border-transparent hover:border-[color:var(--border-strong)]',
              )}
            >
              <button className="flex-1 text-left" onClick={() => onSelect(session.id)}>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{session.title}</p>
                <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
                  <span>
                    {new Date(session.updated_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <CircleDot className="size-3" aria-hidden />
                    {tokenCount}
                  </span>
                </div>
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="border border-transparent px-2 py-1 text-xs uppercase tracking-[0.3em] text-[color:var(--text-muted)] opacity-0 transition hover:text-[color:var(--accent-primary)] group-hover:opacity-100">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Session actions</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="z-20 min-w-[160px] border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-2 text-sm text-[color:var(--text-primary)]">
                    <DropdownMenu.Item
                      className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-panel)]"
                      onSelect={(event) => {
                        event.preventDefault()
                        onRenameRequest(session)
                      }}
                    >
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-red-300 hover:bg-red-500/10"
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
        {!sessions.length && status === 'idle' && <p className="text-sm text-[color:var(--text-muted)]">Create your first session to start chatting.</p>}
      </div>
    </aside>
  )
}
