import { useId, useMemo, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { Paperclip, SendHorizontal, Settings2, XCircle } from 'lucide-react'
import type { ChatSendOptions } from '@/hooks/useChatSession'
import type { GenerationDefaults } from '@/api/client'
import clsx from 'clsx'

export type ChatComposerProps = {
  defaults?: GenerationDefaults
  disabled?: boolean
  isStreaming: boolean
  statusMessage?: string
  error?: string
  onSend: (options: ChatSendOptions) => Promise<void>
  onCancel: () => void
}

export function ChatComposer({ defaults, disabled, isStreaming, statusMessage, error, onSend, onCancel }: ChatComposerProps) {
  const [prompt, setPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showTuning, setShowTuning] = useState(false)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [model, setModel] = useState(() => defaults?.model ?? '')
  const [temperature, setTemperature] = useState(() => defaults?.temperature ?? 0.7)
  const [topP, setTopP] = useState(() => defaults?.top_p ?? 0.9)
  const [topK, setTopK] = useState<string>(() => defaults?.top_k?.toString() ?? '')
  const [repeatPenalty, setRepeatPenalty] = useState<string>(() => defaults?.repeat_penalty?.toString() ?? '')
  const [contextWindow, setContextWindow] = useState<string>(() => defaults?.context_window?.toString() ?? '')
  const [maxTokens, setMaxTokens] = useState<string>(() => defaults?.max_tokens?.toString() ?? '')
  const [stopSequences, setStopSequences] = useState(() => (defaults?.stop ?? []).join('\n'))
  const baseId = useId()
  const ids = useMemo(
    () => ({
      topK: `${baseId}-top-k`,
      repeatPenalty: `${baseId}-repeat-penalty`,
      contextWindow: `${baseId}-context-window`,
      maxTokens: `${baseId}-max-tokens`,
      stop: `${baseId}-stop`,
    }),
    [baseId],
  )

  const isPromptValid = prompt.trim().length > 0

  const parsedStopSequences = useMemo(() => {
    const entries = stopSequences
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    return entries.length ? entries : undefined
  }, [stopSequences])

  const handleSend = async () => {
    if (!isPromptValid || disabled) return
    const overrides: ChatSendOptions['overrides'] = {
      temperature,
      top_p: topP,
      top_k: topK ? Number(topK) : undefined,
      repeat_penalty: repeatPenalty ? Number(repeatPenalty) : undefined,
      context_window: contextWindow ? Number(contextWindow) : undefined,
      max_tokens: maxTokens ? Number(maxTokens) : undefined,
      stop: parsedStopSequences,
    }
    await onSend({
      prompt: prompt.trim(),
      model: model || defaults?.model,
      systemPrompt: systemPrompt.trim() || undefined,
      overrides,
    })
    setPrompt('')
  }

  const resetOverrides = () => {
    if (!defaults) return
    setTemperature(defaults.temperature)
    setTopP(defaults.top_p)
    setTopK(defaults.top_k?.toString() ?? '')
    setRepeatPenalty(defaults.repeat_penalty?.toString() ?? '')
    setContextWindow(defaults.context_window?.toString() ?? '')
    setMaxTokens(defaults.max_tokens?.toString() ?? '')
    setStopSequences((defaults.stop ?? []).join('\n'))
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-5">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]">
        <button
          type="button"
          className={clsx(
            'inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-xs font-medium uppercase tracking-[0.35em] transition',
            showSystemPrompt && 'border-[color:var(--accent-primary)]',
          )}
          onClick={() => setShowSystemPrompt((value) => !value)}
        >
          System Prompt
        </button>
        <button
          type="button"
          className={clsx(
            'inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-xs font-medium uppercase tracking-[0.35em] transition',
            showTuning && 'border-[color:var(--accent-primary)]',
          )}
          onClick={() => setShowTuning((value) => !value)}
        >
          <Settings2 className="size-4" /> Parameters
        </button>
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-3 py-1">
          Model
          <input
            className="bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={defaults?.model}
          />
        </div>
        {statusMessage && <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1">{statusMessage}</span>}
        {error && <span className="rounded-full bg-red-500/10 px-3 py-1 text-red-200">{error}</span>}
      </div>

      {showSystemPrompt && (
        <TextareaAutosize
          minRows={2}
          className="w-full rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none"
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
          placeholder="You can steer the assistant with a system prompt"
        />
      )}

      <div className="flex items-start gap-3">
        <button
          type="button"
          className="rounded-2xl border border-[color:var(--border-strong)] p-3 text-[color:var(--text-muted)]"
          title="Attachment support ships in Phase 8"
          disabled
        >
          <Paperclip className="size-5" />
        </button>
        <TextareaAutosize
          minRows={3}
          maxRows={10}
          className="flex-1 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-base)] px-4 py-3 text-base text-[color:var(--text-primary)] outline-none"
          placeholder="Ask anything…"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              void handleSend()
            }
          }}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={isStreaming ? onCancel : () => void handleSend()}
          disabled={!isStreaming && (!isPromptValid || disabled)}
          className={clsx(
            'rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.35em] transition',
            isStreaming
              ? 'border border-red-400/50 text-red-200'
              : 'bg-[color:var(--accent-primary)] text-black hover:opacity-90',
          )}
        >
          {isStreaming ? (
            <span className="inline-flex items-center gap-2">
              <XCircle className="size-4" /> Cancel
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <SendHorizontal className="size-4" /> Send
            </span>
          )}
        </button>
      </div>

      {showTuning && (
        <div className="grid gap-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4 md:grid-cols-2">
          <label className="text-sm text-[color:var(--text-primary)]">
            Temperature ({temperature.toFixed(2)})
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm text-[color:var(--text-primary)]">
            Top P ({topP.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={topP}
              onChange={(event) => setTopP(Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm text-[color:var(--text-primary)]" htmlFor={ids.topK}>
            Top K
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3 py-2"
              value={topK}
              onChange={(event) => setTopK(event.target.value)}
              placeholder="Auto"
              id={ids.topK}
            />
          </label>
          <label className="text-sm text-[color:var(--text-primary)]" htmlFor={ids.repeatPenalty}>
            Repeat Penalty
            <input
              type="number"
              min={0}
              step={0.1}
              className="mt-2 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3 py-2"
              value={repeatPenalty}
              onChange={(event) => setRepeatPenalty(event.target.value)}
              placeholder="Auto"
              id={ids.repeatPenalty}
            />
          </label>
          <label className="text-sm text-[color:var(--text-primary)]" htmlFor={ids.contextWindow}>
            Context Window
            <input
              type="number"
              min={256}
              step={256}
              className="mt-2 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3 py-2"
              value={contextWindow}
              onChange={(event) => setContextWindow(event.target.value)}
              placeholder="Auto"
              id={ids.contextWindow}
            />
          </label>
          <label className="text-sm text-[color:var(--text-primary)]" htmlFor={ids.maxTokens}>
            Max Tokens
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3 py-2"
              value={maxTokens}
              onChange={(event) => setMaxTokens(event.target.value)}
              placeholder="Auto"
              id={ids.maxTokens}
            />
          </label>
          <label className="text-sm text-[color:var(--text-primary)] md:col-span-2" htmlFor={ids.stop}>
            Stop sequences (one per line)
            <TextareaAutosize
              minRows={2}
              className="mt-2 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3 py-2"
              value={stopSequences}
              onChange={(event) => setStopSequences(event.target.value)}
              id={ids.stop}
            />
          </label>
          <button
            type="button"
            className="rounded-xl border border-[color:var(--border-strong)] px-4 py-2 text-sm text-[color:var(--text-muted)] hover:border-[color:var(--accent-primary)]"
            onClick={resetOverrides}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </section>
  )
}
