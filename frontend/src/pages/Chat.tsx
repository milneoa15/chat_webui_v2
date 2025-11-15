import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle } from 'lucide-react'
import type { HealthResponse, MessageRead, SessionRead } from '@/api/client'
import { ChatSidebar } from '@/components/ChatSidebar'
import { ChatTranscript } from '@/components/ChatTranscript'
import { ChatComposer } from '@/components/ChatComposer'
import { ChatMetricsHUD } from '@/components/ChatMetricsHUD'
import { useChatSession } from '@/hooks/useChatSession'
import { useConfigStore } from '@/stores/config'
import { useSessionsStore } from '@/stores/sessions'

type OutletContext = {
  health?: HealthResponse
}

export function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { health } = useOutletContext<OutletContext>()
  const {
    sessions,
    status,
    selectedSessionId,
    refresh,
    createSession,
    selectSession,
    metrics,
    renameSession,
    deleteSession,
    error: sessionError,
  } = useSessionsStore()
  const config = useConfigStore((state) => state.config)
  const [renameTarget, setRenameTarget] = useState<SessionRead | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SessionRead | null>(null)
  const [bannerMessage, setBannerMessage] = useState<string | undefined>()
  const { messages, error, stream, lastCompletion, sendPrompt, cancelStream, deleteMessage, togglePin, regenerate, session } =
    useChatSession(selectedSessionId)

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

  useEffect(() => {
    if (!selectedSessionId || !sessions.length) {
      return
    }
    const exists = sessions.some((s) => s.id === selectedSessionId)
    if (!exists) {
      navigate('/chat')
    }
  }, [selectedSessionId, sessions, navigate])

  useEffect(() => {
    if (!bannerMessage) return
    const timer = window.setTimeout(() => setBannerMessage(undefined), 2400)
    return () => window.clearTimeout(timer)
  }, [bannerMessage])

  const handleCreateSession = async () => {
    try {
      const created = await createSession()
      navigate(`/chat/${created.id}`)
    } catch (error) {
      console.error('Failed to create session', error)
    }
  }

  const handleSelectSession = (id: number) => {
    selectSession(id)
    navigate(`/chat/${id}`)
  }

  const handleCopy = async (message: MessageRead) => {
    try {
      await navigator.clipboard.writeText(message.content)
      setBannerMessage('Copied message to clipboard')
    } catch (error) {
      console.error('Clipboard copy failed', error)
    }
  }

  const handleShare = async (message: MessageRead) => {
    const payload = `${message.role.toUpperCase()} @ ${new Date(message.created_at).toLocaleString()}\n\n${message.content}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Chat excerpt', text: payload })
        return
      } catch (error) {
        console.warn('Share aborted', error)
      }
    }
    try {
      await navigator.clipboard.writeText(payload)
      setBannerMessage('Copied sharable excerpt to clipboard')
    } catch (error) {
      console.error('Unable to share message', error)
    }
  }

  const selectedMetrics = selectedSessionId ? metrics[selectedSessionId] : undefined
  const composerDefaultsKey = config?.generation_defaults ? JSON.stringify(config.generation_defaults) : 'no-defaults'
  const healthCards = useMemo(
    () => [
      { label: 'Database', value: health?.db_status ?? 'checking' },
      { label: 'Ollama', value: health?.ollama_status ?? 'checking' },
      { label: 'Scheduler', value: health?.scheduler_status ?? 'checking' },
    ],
    [health?.db_status, health?.ollama_status, health?.scheduler_status],
  )

  const showEmptyState = !selectedSessionId && !sessions.length

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <ChatSidebar
        sessions={sessions}
        status={status}
        error={sessionError}
        metrics={metrics}
        selectedSessionId={selectedSessionId}
        onSelect={handleSelectSession}
        onCreate={handleCreateSession}
        onRefresh={() => {
          void refresh()
        }}
        onRenameRequest={(session) => {
          setRenameTarget(session)
          setRenameValue(session.title)
        }}
        onDeleteRequest={(session) => setDeleteTarget(session)}
      />

      <section className="space-y-5">
        <div className="space-y-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-6">
          <header className="flex flex-col gap-3 border-b border-[color:var(--border-strong)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Session diagnostics</p>
              <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">
                {session?.title ?? 'No session selected'}
              </h2>
              <p className="text-sm text-[color:var(--text-muted)]">
                {session ? `Updated ${new Date(session.updated_at).toLocaleString()}` : 'Create or select a chat to get started.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void refresh()
                }}
                className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--text-muted)]"
              >
                Refresh
              </button>
              <button
                onClick={() => session && setRenameTarget(session)}
                disabled={!session}
                className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--text-muted)] disabled:opacity-40"
              >
                Rename
              </button>
              <button
                onClick={() => session && setDeleteTarget(session)}
                disabled={!session}
                className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-200 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </header>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {healthCards.map((card) => (
              <article key={card.label} className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">{card.label}</p>
                <p className="mt-2 text-lg font-semibold capitalize text-[color:var(--text-primary)]">{card.value}</p>
              </article>
            ))}
          </div>
          <ChatMetricsHUD lastCompletion={lastCompletion} sessionMetrics={selectedMetrics} isStreaming={stream.active} />
        </div>

        {showEmptyState ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-10 text-center">
            <AlertTriangle className="mx-auto size-10 text-[color:var(--text-muted)]" />
            <p className="mt-4 text-lg font-semibold text-[color:var(--text-primary)]">Create your first session</p>
            <p className="text-sm text-[color:var(--text-muted)]">Once a session exists the chat history, composer, and metrics will appear here.</p>
          </div>
        ) : (
          <>
            <ChatTranscript
              messages={messages}
              streamContent={stream.content}
              streamActive={stream.active}
              streamStatus={stream.status}
              onCopy={handleCopy}
              onDelete={(message) => {
                void deleteMessage(message.id)
              }}
              onRegenerate={(message) => {
                if (message.role === 'assistant') {
                  void regenerate(message.id)
                }
              }}
              onShare={handleShare}
              onTogglePin={(message) => {
                void togglePin(message)
              }}
            />
            {bannerMessage && <p className="text-center text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">{bannerMessage}</p>}
            <ChatComposer
              key={composerDefaultsKey}
              defaults={config?.generation_defaults}
              disabled={!session}
              isStreaming={stream.active}
              statusMessage={stream.status}
              error={error}
              onSend={(options) => sendPrompt(options)}
              onCancel={cancelStream}
            />
          </>
        )}
      </section>

      <Dialog.Root open={Boolean(renameTarget)} onOpenChange={(next) => !next && setRenameTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6">
            <Dialog.Title className="text-xl font-semibold">Rename session</Dialog.Title>
            <input
              className="mt-4 w-full rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-4 py-3 text-base"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button
                className="rounded-full bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-black"
                onClick={() => {
                  if (renameTarget && renameValue.trim()) {
                    void renameSession(renameTarget.id, renameValue.trim()).then(() => setRenameTarget(null))
                  }
                }}
              >
                Save
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6">
            <Dialog.Title className="text-xl font-semibold text-red-200">Delete session</Dialog.Title>
            <p className="mt-3 text-sm text-[color:var(--text-muted)]">
              This removes {deleteTarget?.title}. Messages, metrics, and streams cannot be recovered.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-100"
                onClick={() => {
                  if (deleteTarget) {
                    void deleteSession(deleteTarget.id).then(() => setDeleteTarget(null))
                  }
                }}
              >
                Delete permanently
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
