import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import type { MessageRead, SessionRead } from '@/api/client'
import { ChatSidebar } from '@/components/ChatSidebar'
import { ChatTranscript } from '@/components/ChatTranscript'
import { ChatComposer } from '@/components/ChatComposer'
import { ModelSelector } from '@/components/ModelSelector'
import { useChatSession } from '@/hooks/useChatSession'
import { useConfigStore } from '@/stores/config'
import { useSessionsStore } from '@/stores/sessions'

export function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
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
  const [sessionModels, setSessionModels] = useState<Record<number, string>>({})
  const { messages, error, stream, sendPrompt, cancelStream, deleteMessage, togglePin, regenerate, session } = useChatSession(selectedSessionId)

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

  const composerDefaultsKey = config?.generation_defaults ? JSON.stringify(config.generation_defaults) : 'no-defaults'
  const hasSessions = sessions.length > 0
  const showPlaceholder = !session
  const activeModel = session ? sessionModels[session.id] : undefined
  const composerDisabled = !session || !activeModel

  const persistModelSelection = (targetSessionId: number, model?: string) => {
    setSessionModels((prev) => {
      const next = { ...prev }
      if (!model) {
        delete next[targetSessionId]
      } else {
        next[targetSessionId] = model
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden lg:flex-row">
      <div className="w-full shrink-0 lg:w-[320px]">
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
      </div>

      <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)]">
        {showPlaceholder ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-[color:var(--text-muted)]">
            <p className="font-mono text-xs uppercase tracking-[0.45em]">{hasSessions ? 'Select a session' : 'No sessions yet'}</p>
            <p className="text-lg font-semibold text-[color:var(--text-primary)]">
              {hasSessions ? 'Use the left rail to choose a conversation.' : 'Create your first conversation to begin.'}
            </p>
          </div>
        ) : (
          <>
            <header className="border-b border-[color:var(--border-strong)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.45em] text-[color:var(--text-muted)]">Active Session</p>
                  <p className="text-xl font-semibold text-[color:var(--text-primary)]">{session.title}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">Updated {new Date(session.updated_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
                  <button
                    onClick={() => {
                      void refresh()
                    }}
                    className="rounded-full border border-[color:var(--border-strong)] px-4 py-2"
                  >
                    Sync
                  </button>
                  <button className="rounded-full border border-[color:var(--border-strong)] px-4 py-2" onClick={() => setRenameTarget(session)}>
                    Rename
                  </button>
                  <button className="rounded-full border border-red-400/40 px-4 py-2 text-red-200" onClick={() => setDeleteTarget(session)}>
                    Delete
                  </button>
                </div>
              </div>
            </header>

            <div className="border-b border-[color:var(--border-strong)] px-5 py-3">
              <ModelSelector
                selectedModel={activeModel}
                disabled={!session}
                onSelect={(model) => {
                  if (session) {
                    persistModelSelection(session.id, model)
                  }
                }}
                onClear={() => {
                  if (session) {
                    persistModelSelection(session.id)
                  }
                }}
              />
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
              <div className="flex-1 overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)]">
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
              </div>
              {bannerMessage && (
                <p className="text-center font-mono text-[10px] uppercase tracking-[0.4em] text-[color:var(--text-muted)]">{bannerMessage}</p>
              )}
              <ChatComposer
                key={composerDefaultsKey}
                defaults={config?.generation_defaults}
                model={activeModel}
                disabled={composerDisabled}
                isStreaming={stream.active}
                statusMessage={stream.status}
                error={error}
                onSend={(options) => sendPrompt(options)}
                onCancel={cancelStream}
              />
            </div>
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
