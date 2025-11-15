import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, RefreshCw, Share2, Trash2, Pin, PinOff } from 'lucide-react'
import type { MessageRead } from '@/api/client'
import clsx from 'clsx'
import 'highlight.js/styles/github-dark.css'

const roleMap: Record<MessageRead['role'], { label: string; accent: string }> = {
  system: { label: 'System', accent: 'text-amber-300' },
  user: { label: 'You', accent: 'text-[color:var(--accent-primary)]' },
  assistant: { label: 'Assistant', accent: 'text-sky-300' },
  tool: { label: 'Tool', accent: 'text-purple-300' },
}

export type ChatMessageProps = {
  message: MessageRead
  onCopy: (message: MessageRead) => void
  onDelete: (message: MessageRead) => void
  onRegenerate: (message: MessageRead) => void
  onShare: (message: MessageRead) => void
  onTogglePin: (message: MessageRead) => void
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onCopy,
  onDelete,
  onRegenerate,
  onShare,
  onTogglePin,
}: ChatMessageProps) {
  const roleMeta = roleMap[message.role]
  const tokens = (message.prompt_tokens ?? 0) + (message.completion_tokens ?? 0)
  const showActions = message.role !== 'system'

  return (
    <article
      className={clsx(
        'group rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-5 shadow-sm transition',
        message.is_pinned && 'ring-1 ring-[color:var(--accent-primary)]',
      )}
    >
      <header className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
        <span className={clsx('font-semibold', roleMeta.accent)}>{roleMeta.label}</span>
        <time className="text-[color:var(--text-muted)]">
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>
      <div className="prose prose-invert max-w-none text-[color:var(--text-primary)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>
      </div>
      <footer className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]">
        {typeof message.model === 'string' && message.model && <span className="rounded-full border border-[color:var(--border-strong)] px-3 py-1">{message.model}</span>}
        {tokens > 0 && <span>{tokens} tokens</span>}
        {message.metrics?.tokens_per_second && <span>{message.metrics.tokens_per_second} tok/s</span>}
        {showActions && (
          <div className="ml-auto flex items-center gap-2 text-[color:var(--text-muted)] opacity-0 transition group-hover:opacity-100">
            {message.role === 'assistant' && (
              <button
                className="rounded-full border border-transparent p-2 hover:border-[color:var(--border-strong)]"
                onClick={() => onRegenerate(message)}
                title="Regenerate"
              >
                <RefreshCw className="size-4" />
              </button>
            )}
            <button
              className="rounded-full border border-transparent p-2 hover:border-[color:var(--border-strong)]"
              onClick={() => onCopy(message)}
              title="Copy"
            >
              <Copy className="size-4" />
            </button>
            <button
              className="rounded-full border border-transparent p-2 hover:border-[color:var(--border-strong)]"
              onClick={() => onShare(message)}
              title="Share"
            >
              <Share2 className="size-4" />
            </button>
            <button
              className="rounded-full border border-transparent p-2 hover:border-[color:var(--border-strong)]"
              onClick={() => onTogglePin(message)}
              title={message.is_pinned ? 'Unpin message' : 'Pin message'}
            >
              {message.is_pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            </button>
            <button
              className="rounded-full border border-transparent p-2 hover:border-[color:var(--border-strong)]"
              onClick={() => onDelete(message)}
              title="Delete"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </footer>
    </article>
  )
})
