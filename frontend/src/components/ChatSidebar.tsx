import { useEffect, useMemo, useRef, useState } from 'react'
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
  const searchInputRef = useRef<HTMLInputElement | null>(null)

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

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  const filteredSessions = useMemo(() => {
    if (!query.trim()) return sessions
    const lower = query.toLowerCase()
    return sessions.filter((session) => session.title.toLowerCase().includes(lower))
  }, [sessions, query])

  return (
    <aside className="flex h-full flex-col gap-3 bg-transparent px-2 py-3 text-sm text-[color:var(--text-primary)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border-strong)] pb-1 text-[color:var(--accent-primary)]">
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
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={onCreate}
          className="flex size-7 items-center justify-center border border-[color:var(--accent-primary)] text-[color:var(--accent-primary)] hover:text-[color:var(--text-primary)]"
        >
          <Plus className="size-4" aria-hidden />
          <span className="sr-only">New session</span>
        </button>
        <button
          onClick={onRefresh}
          className="flex size-7 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)]"
        >
          <RefreshCw className="size-4" aria-hidden />
          <span className="sr-only">Sync sessions</span>
        </button>
        <button
          onClick={() => setSearchOpen((value) => !value)}
          className="flex size-7 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)]"
          aria-expanded={searchOpen}
        >
          <Search className="size-4" aria-hidden />
          <span className="sr-only">Search sessions</span>
        </button>
      </div>
      {searchOpen && (
        <div className="border-b border-[color:var(--border-strong)] pb-1">
          <input
            ref={searchInputRef}
            className="w-full border-none bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
            placeholder="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto pr-1">
        {status === 'loading' && <p className="text-sm text-[color:var(--text-muted)]">Loading sessions…</p>}
        {error && <p className="bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
        {filteredSessions.map((session) => {
          const sessionMetrics = metrics[session.id]
          const tokenCount = (sessionMetrics?.total_prompt_tokens ?? 0) + (sessionMetrics?.total_completion_tokens ?? 0)
          return (
            <div
              key={session.id}
              className={clsx(
                'group border-b border-[color:var(--border-strong)] px-1 py-1 text-xs transition',
                selectedSessionId === session.id
                  ? 'border-l-2 border-l-[color:var(--accent-primary)] bg-[color:var(--surface-muted)]/40 text-[color:var(--accent-primary)]'
                  : 'border-l-2 border-l-transparent text-[color:var(--text-primary)] hover:bg-[color:var(--surface-muted)]/10',
              )}
            >
              <button className="flex w-full flex-col text-left" onClick={() => onSelect(session.id)}>
                <p className="line-clamp-1 font-semibold">{session.title}</p>
                <div
                  className={clsx(
                    'mt-0.5 flex flex-wrap items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)] transition-all duration-200',
                    selectedSessionId === session.id
                      ? 'max-h-12 opacity-100'
                      : 'max-h-0 overflow-hidden opacity-0 group-hover:max-h-12 group-hover:opacity-100',
                  )}
                >
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
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="border border-transparent px-1 text-[color:var(--text-muted)] transition hover:text-[color:var(--accent-primary)]">
                        <MoreHorizontal className="size-3" />
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
              </button>
            </div>
          )
        })}
        {!sessions.length && status === 'idle' && (
          <p className="px-2 py-1 text-xs text-[color:var(--text-muted)]">Create your first session to start chatting.</p>
        )}
      </div>
    </aside>
  )
}
