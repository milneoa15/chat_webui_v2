import { Fragment, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Code, FileText, MessageSquare } from 'lucide-react'
import type { MessageRead } from '@/api/client'
import { ChatMessage } from '@/components/ChatMessage'

export type ChatTranscriptProps = {
  sessionId?: number
  messages: MessageRead[]
  streamContent?: string
  streamThinking?: string
  streamActive: boolean
  streamStatus?: string
  onCopy: (message: MessageRead) => void
  onDelete: (message: MessageRead) => void
  headerControls?: ReactNode
  showThinking?: boolean
}

const COLLAPSE_THRESHOLD = 800

export function ChatTranscript({
  sessionId,
  messages,
  streamContent,
  streamThinking,
  streamActive,
  streamStatus,
  onCopy,
  onDelete,
  headerControls,
  showThinking = false,
  }: ChatTranscriptProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  const lastScrollTopRef = useRef(0)
  const [formatMode, setFormatMode] = useState<'markdown' | 'raw'>('markdown')
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<number, boolean>>({})

  const scrollToBottom = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight
      lastScrollTopRef.current = element.scrollTop
    })
  }, [])

  useEffect(() => {
    if (!autoScrollEnabled) return
    scrollToBottom()
  }, [messages, streamContent, streamThinking, autoScrollEnabled, scrollToBottom])

  useEffect(() => {
    if (!streamActive && sessionId === undefined) return
    const timer = window.setTimeout(() => {
      setAutoScrollEnabled(true)
      scrollToBottom()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [sessionId, streamActive, scrollToBottom])

  const collapseDefaults = useMemo(() => {
    const next: Record<number, boolean> = {}
    const lastIndex = messages.length - 1
    messages.forEach((message, index) => {
      if (message.content.length <= COLLAPSE_THRESHOLD) {
        return
      }
      if (index < lastIndex) {
        next[message.id] = true
      } else {
        next[message.id] = false
      }
    })
    return next
  }, [messages])

  const handleToggleCollapse = useCallback(
    (messageId: number) => {
      setCollapsedOverrides((prev) => {
        const current = prev[messageId] ?? collapseDefaults[messageId] ?? false
        const nextValue = !current
        const next = { ...prev, [messageId]: nextValue }
        if (nextValue === (collapseDefaults[messageId] ?? false)) {
          delete next[messageId]
        }
        return next
      })
    },
    [collapseDefaults],
  )

  const formatToggle = useMemo(
    () => (
      <div className="flex gap-1">
        <button
          className={`flex size-7 items-center justify-center ${formatMode === 'markdown' ? 'text-[color:var(--accent-primary)]' : ''}`}
          onClick={() => setFormatMode('markdown')}
          title="Formatted view"
        >
          <FileText className="size-4" aria-hidden />
          <span className="sr-only">Formatted view</span>
        </button>
        <button
          className={`flex size-7 items-center justify-center ${formatMode === 'raw' ? 'text-[color:var(--accent-primary)]' : ''}`}
          onClick={() => setFormatMode('raw')}
          title="Raw text view"
        >
          <Code className="size-4" aria-hidden />
          <span className="sr-only">Raw text view</span>
        </button>
      </div>
    ),
    [formatMode],
  )

  return (
    <div className="flex flex-1 min-h-0 flex-col border border-[color:var(--border-strong)] border-t-0 lg:border-l-0">
      <div className="flex h-10 items-center justify-between border-b border-[color:var(--border-strong)] px-2 text-[color:var(--text-muted)]">
        {formatToggle}
        {headerControls}
      </div>
      <div
        ref={containerRef}
        className="flex h-full flex-1 flex-col gap-4 overflow-y-auto px-0 py-4"
        onScroll={(event) => {
          const element = event.currentTarget
          const isUserScroll = event.isTrusted
          const previousTop = lastScrollTopRef.current
          lastScrollTopRef.current = element.scrollTop

          const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
          const scrolledUp = isUserScroll && element.scrollTop < previousTop - 1
          if (scrolledUp) {
            setAutoScrollEnabled(false)
          } else if (distanceFromBottom <= 16) {
            setAutoScrollEnabled(true)
          }
        }}
      >
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined
          const showDivider =
            previous &&
            ((previous.role === 'user' && message.role === 'assistant') || (previous.role === 'assistant' && message.role === 'user'))
          const collapsedState = collapsedOverrides[message.id] ?? collapseDefaults[message.id] ?? false

          return (
            <Fragment key={message.id}>
              {showDivider && <div className="border-t border-[color:var(--border-strong)]" aria-hidden="true" />}
              <ChatMessage
                message={message}
                formatMode={formatMode}
                collapsed={collapsedState}
                canCollapse={message.content.length > COLLAPSE_THRESHOLD}
                onToggleCollapse={() => handleToggleCollapse(message.id)}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            </Fragment>
          )
        })}
        {streamActive && showThinking && streamThinking && (
          <article className="px-3 py-2 text-xs text-[color:var(--accent-primary)]">
            <p className="mb-1 text-[10px] uppercase tracking-[0.4em] text-[color:var(--text-muted)]">Thinking…</p>
            <pre className="whitespace-pre-wrap break-words text-[color:var(--accent-primary)]">
              {streamThinking}
            </pre>
          </article>
        )}
        {streamActive && (
          <article className="px-3 py-2 text-sm text-[color:var(--accent-primary)]">
            <p className="sr-only">{streamStatus ?? 'Streaming response'}</p>
            {formatMode === 'markdown' ? (
              <div className="prose prose-invert max-w-none text-[color:var(--text-primary)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {streamContent}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-xs text-[color:var(--text-primary)]">{streamContent}</pre>
            )}
          </article>
        )}
        {!messages.length && !streamActive && (
          <div className="flex flex-1 items-center justify-center border border-dashed border-[color:var(--border-strong)] px-3 py-4 text-center text-[color:var(--text-muted)]">
            <MessageSquare className="size-5" aria-hidden />
            <span className="sr-only">No messages yet</span>
          </div>
        )}
      </div>
    </div>
  )
}
