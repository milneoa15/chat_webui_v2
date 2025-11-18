import { useState, type FormEvent } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import type { ChatSendOptions } from '@/hooks/useChatSession'
import { AlertTriangle, Square, Waves } from 'lucide-react'

export type ChatComposerProps = {
  model?: string
  disabled?: boolean
  isStreaming: boolean
  statusMessage?: string
  error?: string
  onSend: (options: ChatSendOptions) => Promise<void>
  onCancel: () => void
}

export function ChatComposer({ model, disabled, isStreaming, statusMessage, error, onSend, onCancel }: ChatComposerProps) {
  const [prompt, setPrompt] = useState('')

  const composerDisabled = disabled || !model

  const handleSend = async () => {
    const nextPrompt = prompt.trim()
    if (!nextPrompt.length || composerDisabled) return
    setPrompt('')
    try {
      await onSend({
        prompt: nextPrompt,
        model,
      })
    } catch (error) {
      setPrompt(nextPrompt)
      console.error('Prompt send failed', error)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void handleSend()
  }

  return (
    <form
      className="chat-composer relative flex flex-col gap-0 border-t border-[color:var(--border-strong)] pt-0 pb-0"
      onSubmit={handleSubmit}
    >
      <TextareaAutosize
        minRows={1}
        maxRows={8}
        className="chat-composer-input w-full max-h-56 resize-none overflow-y-auto bg-transparent px-3 pr-28 py-2 text-base leading-relaxed text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:ring-0"
        placeholder={composerDisabled ? 'Load a model to begin…' : '>'}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
          }
        }}
        disabled={composerDisabled}
      />
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {statusMessage && (
          <span className="text-[color:var(--accent-primary)]" title={statusMessage}>
            <Waves className="size-4" aria-hidden />
            <span className="sr-only">{statusMessage}</span>
          </span>
        )}
        {error && (
          <span className="text-red-400" title={error}>
            <AlertTriangle className="size-4" aria-hidden />
            <span className="sr-only">{error}</span>
          </span>
        )}
        {isStreaming && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-[color:var(--border-strong)] px-2 py-2 text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)]"
            title="Cancel response"
          >
            <Square className="size-4" aria-hidden />
            <span className="sr-only">Cancel response</span>
          </button>
        )}
      </div>
    </form>
  )
}
