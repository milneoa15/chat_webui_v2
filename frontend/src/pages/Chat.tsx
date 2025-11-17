import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Brain, MessageSquare, PanelLeft, Plus } from 'lucide-react'
import clsx from 'clsx'
import type { MessageRead, SessionRead } from '@/api/client'
import { ChatSidebar } from '@/components/ChatSidebar'
import { ChatTranscript } from '@/components/ChatTranscript'
import { ChatComposer } from '@/components/ChatComposer'
import { ModelSelector } from '@/components/ModelSelector'
import { useChatSession } from '@/hooks/useChatSession'
import { useSessionsStore } from '@/stores/sessions'
import type { ProtectedLayoutContext } from '@/components/ProtectedLayout'
import { useConfigStore } from '@/stores/config'

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
    lastUpdated,
  } = useSessionsStore()
  const [renameTarget, setRenameTarget] = useState<SessionRead | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SessionRead | null>(null)
  const [sessionModels, setSessionModels] = useState<Record<number, string>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { messages, error, stream, sendPrompt, cancelStream, deleteMessage, session } = useChatSession(selectedSessionId)
  const outletContext = useOutletContext<ProtectedLayoutContext | null>()
  const setHeaderActions = outletContext?.setHeaderActions
  const thinkingEnabled = useConfigStore((state) => state.thinkingEnabled)
  const setThinkingEnabled = useConfigStore((state) => state.setThinkingEnabled)

  useEffect(() => {
    if (!lastUpdated && status === 'idle') {
      void refresh()
    }
  }, [lastUpdated, status, refresh])

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

  const handleCreateSession = useCallback(async () => {
    try {
      const created = await createSession()
      navigate(`/chat/${created.id}`)
    } catch (error) {
      console.error('Failed to create session', error)
    }
  }, [createSession, navigate])

  const handleSelectSession = (id: number) => {
    selectSession(id)
    navigate(`/chat/${id}`)
  }

  const handleCopy = async (message: MessageRead) => {
    try {
      await navigator.clipboard.writeText(message.content)
    } catch (error) {
      console.error('Clipboard copy failed', error)
    }
  }

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

  const modelControls = session ? (
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
      variant="minimal"
    />
  ) : null

  const reasoningToggle = (
    <button
      className={clsx(
        'flex size-7 items-center justify-center border',
        thinkingEnabled
          ? 'border-[color:var(--accent-primary)] text-[color:var(--accent-primary)]'
          : 'border-[color:var(--border-strong)] text-[color:var(--text-muted)]',
      )}
      onClick={() => setThinkingEnabled(!thinkingEnabled)}
      type="button"
      title={thinkingEnabled ? 'Disable reasoning view' : 'Enable reasoning view'}
    >
      <span className="sr-only">Toggle reasoning</span>
      <Brain className="size-4" aria-hidden />
    </button>
  )

  const transcriptControls = (
    <div className="flex items-center gap-2">
      {modelControls}
      {reasoningToggle}
    </div>
  )

  useEffect(() => {
    if (!setHeaderActions) {
      return
    }
    if (!sidebarOpen) {
      setHeaderActions(
        <>
          <button
            className="flex size-7 items-center justify-center border border-[color:var(--accent-primary)] text-[color:var(--accent-primary)] transition hover:text-[color:var(--text-primary)]"
            onClick={handleCreateSession}
            title="New session"
          >
            <Plus className="size-4" aria-hidden />
            <span className="sr-only">New session</span>
          </button>
          <button
            className="flex size-7 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] transition hover:text-[color:var(--accent-primary)]"
            onClick={() => setSidebarOpen(true)}
            title="Expand sidebar"
          >
            <PanelLeft className="size-4" aria-hidden />
            <span className="sr-only">Expand sidebar</span>
          </button>
        </>,
      )
    } else {
      setHeaderActions(null)
    }
    return () => {
      setHeaderActions(null)
    }
  }, [handleCreateSession, setHeaderActions, sidebarOpen])

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden text-sm lg:flex-row">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/70 backdrop-blur-sm lg:hidden"
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSidebarOpen(false)
            }
          }}
        />
      )}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-20 w-full max-w-[220px] transform overflow-hidden bg-[color:var(--surface-base)]/95 lg:relative lg:z-0 lg:max-w-[220px] lg:flex-shrink-0 lg:transform-none',
          sidebarOpen
            ? 'translate-x-0 lg:w-[220px]'
            : '-translate-x-full lg:w-0 lg:pointer-events-none',
        )}
      >
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
          onCollapse={() => setSidebarOpen(false)}
        />
      </div>

      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0 font-mono text-sm text-[color:var(--text-primary)] lg:border-l lg:border-[color:var(--border-strong)]">
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {showPlaceholder ? (
            <div className="flex flex-1 items-center justify-center border border-dashed border-[color:var(--border-strong)] border-t-0 lg:border-l-0">
              <MessageSquare className="size-6 text-[color:var(--text-muted)]" aria-hidden />
              <span className="sr-only">{hasSessions ? 'Select a session to continue' : 'Create a session to begin'}</span>
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col overflow-hidden min-h-0">
                <ChatTranscript
                  sessionId={session?.id}
                  messages={messages}
                  streamContent={stream.content}
                  streamThinking={stream.thinking}
                  streamActive={stream.active}
                  streamStatus={stream.status}
                  onCopy={handleCopy}
                  onDelete={(message) => {
                    void deleteMessage(message.id)
                  }}
                  headerControls={transcriptControls}
                  showThinking={thinkingEnabled}
                />
              </div>
              <div className="shrink-0 border border-[color:var(--border-strong)] border-t-0 lg:border-l-0">
                <ChatComposer
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
        </div>
      </section>

      <Dialog.Root open={Boolean(renameTarget)} onOpenChange={(next) => !next && setRenameTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6 text-sm">
            <Dialog.Title className="text-xl font-semibold text-[color:var(--accent-primary)]">Rename session</Dialog.Title>
            <input
              className="mt-4 w-full rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-4 py-3 text-base"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button className="border border-[color:var(--border-strong)] px-4 py-2 text-sm" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button
                className="border border-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-primary)]"
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
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6">
            <Dialog.Title className="text-xl font-semibold text-red-200">Delete session</Dialog.Title>
            <p className="mt-3 text-sm text-[color:var(--text-muted)]">
              This removes {deleteTarget?.title}. Messages, metrics, and streams cannot be recovered.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="border border-[color:var(--border-strong)] px-4 py-2 text-sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-100"
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
