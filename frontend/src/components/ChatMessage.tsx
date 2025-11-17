import { memo, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { MessageRead } from '@/api/client'
import clsx from 'clsx'
import 'highlight.js/styles/atom-one-dark.css'
import { Brain, Copy, Trash2, ChevronDown } from 'lucide-react'
import { useConfigStore } from '@/stores/config'

const roleMap: Record<MessageRead['role'], { label: string; accent: string }> = {
  system: { label: 'System', accent: 'text-amber-300' },
  user: { label: 'You', accent: 'text-[color:var(--accent-primary)]' },
  assistant: { label: 'Assistant', accent: 'text-sky-300' },
  tool: { label: 'Tool', accent: 'text-purple-300' },
}

export type ChatMessageProps = {
  message: MessageRead
  formatMode: 'markdown' | 'raw'
  collapsed?: boolean
  canCollapse?: boolean
  onToggleCollapse?: () => void
  onCopy: (message: MessageRead) => void
  onDelete: (message: MessageRead) => void
}

export const ChatMessage = memo(function ChatMessage({
  message,
  formatMode,
  collapsed = false,
  canCollapse = false,
  onToggleCollapse,
  onCopy,
  onDelete,
}: ChatMessageProps) {
  const roleMeta = roleMap[message.role]
  const tokens = (message.prompt_tokens ?? 0) + (message.completion_tokens ?? 0)
  const metrics = message.metrics as Record<string, unknown> | undefined
  const tokensPerSecond = typeof metrics?.tokens_per_second === 'number' ? (metrics.tokens_per_second as number) : undefined
  const showThinkingByDefault = useConfigStore((state) => state.thinkingEnabled)
  const [revealThinking, setRevealThinking] = useState(false)
  const thinkingText = useMemo(() => {
    if (!metrics) return undefined
    const keys = ['thinking', 'thinking_text', 'thoughts', 'reasoning', 'trace']
    for (const key of keys) {
      const value = metrics[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value as string
      }
    }
    return undefined
  }, [metrics])

  useEffect(() => {
    if (!showThinkingByDefault) {
      setRevealThinking(false)
    }
  }, [showThinkingByDefault])

  const displayContent = useMemo(() => {
    if (!collapsed) return message.content
    return message.content.length > 320 ? `${message.content.slice(0, 320)}…` : message.content
  }, [collapsed, message.content])

  return (
    <article className={clsx('group border-l border-[color:var(--border-strong)] px-3 py-3', message.is_pinned && 'border-[color:var(--accent-primary)]')}>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.4em] text-[color:var(--text-muted)]">
        <div className="flex items-center gap-2">
          <span className={clsx('font-semibold', roleMeta.accent)}>{roleMeta.label}</span>
          {canCollapse && (
            <button
              className="flex size-5 items-center justify-center text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)]"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand message' : 'Collapse message'}
            >
              <ChevronDown className={clsx('size-3 transition', collapsed && 'rotate-180')} aria-hidden />
              <span className="sr-only">{collapsed ? 'Expand message' : 'Collapse message'}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <time className="text-[color:var(--text-muted)]">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
          <button className="flex size-7 items-center justify-center hover:text-[color:var(--accent-primary)]" onClick={() => onCopy(message)} title="Copy">
            <Copy className="size-4" aria-hidden />
            <span className="sr-only">Copy message</span>
          </button>
          <button className="flex size-7 items-center justify-center hover:text-red-300" onClick={() => onDelete(message)} title="Delete">
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">Delete message</span>
          </button>
        </div>
      </header>
      <div className="text-[color:var(--text-primary)]">
        {formatMode === 'markdown' ? (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {displayContent}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm">{displayContent}</pre>
        )}
      </div>
      <footer className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
        {message.role === 'assistant' && typeof message.model === 'string' && message.model && <span>{message.model}</span>}
        {tokens > 0 && <span>{tokens} tok</span>}
        {typeof tokensPerSecond === 'number' && <span>{tokensPerSecond} tok/s</span>}
        {thinkingText && showThinkingByDefault && (
          <button
            className={clsx(
              'ml-auto flex size-6 items-center justify-center border',
              revealThinking ? 'border-[color:var(--accent-primary)] text-[color:var(--accent-primary)]' : 'border-[color:var(--border-strong)] text-[color:var(--text-muted)]',
            )}
            onClick={() => setRevealThinking((value) => !value)}
            title={revealThinking ? 'Hide reasoning' : 'Show reasoning'}
          >
            <Brain className="size-3" aria-hidden />
            <span className="sr-only">{revealThinking ? 'Hide reasoning' : 'Show reasoning'}</span>
          </button>
        )}
      </footer>
      {thinkingText && showThinkingByDefault && revealThinking && (
        <pre className="mt-2 max-h-56 w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words border-l border-[color:var(--accent-primary)]/60 px-2 py-1 text-xs text-[color:var(--accent-primary)]">
          {thinkingText}
        </pre>
      )}
    </article>
  )
})
