import { useEffect, useRef } from 'react'
import type { MessageRead } from '@/api/client'
import { ChatMessage } from '@/components/ChatMessage'

export type ChatTranscriptProps = {
  messages: MessageRead[]
  streamContent?: string
  streamActive: boolean
  streamStatus?: string
  onCopy: (message: MessageRead) => void
  onDelete: (message: MessageRead) => void
  onRegenerate: (message: MessageRead) => void
  onShare: (message: MessageRead) => void
  onTogglePin: (message: MessageRead) => void
}

export function ChatTranscript({
  messages,
  streamContent,
  streamActive,
  streamStatus,
  onCopy,
  onDelete,
  onRegenerate,
  onShare,
  onTogglePin,
}: ChatTranscriptProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [messages, streamContent])

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-4 overflow-y-auto px-4 py-4">
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onCopy={onCopy}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          onShare={onShare}
          onTogglePin={onTogglePin}
        />
      ))}
      {streamActive && (
        <article className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Streaming response…</p>
          <p className="mt-3 whitespace-pre-wrap text-[color:var(--text-primary)]">{streamContent}</p>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">{streamStatus ?? 'Receiving tokens'}</p>
        </article>
      )}
      {!messages.length && !streamActive && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6 text-center text-sm text-[color:var(--text-muted)]">
          Start the conversation by drafting a prompt below. Session metrics and history will appear here.
        </div>
      )}
    </div>
  )
}
