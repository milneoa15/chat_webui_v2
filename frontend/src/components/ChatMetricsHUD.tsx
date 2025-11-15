import type { SessionMetricsResponse } from '@/api/client'
import type { StreamingState } from '@/hooks/useChatSession'

export type ChatMetricsHUDProps = {
  lastCompletion?: StreamingState
  sessionMetrics?: SessionMetricsResponse
  isStreaming: boolean
}

export function ChatMetricsHUD({ lastCompletion, sessionMetrics, isStreaming }: ChatMetricsHUDProps) {
  const promptTokens = lastCompletion?.promptTokens ?? sessionMetrics?.total_prompt_tokens ?? 0
  const completionTokens = lastCompletion?.completionTokens ?? sessionMetrics?.total_completion_tokens ?? 0
  const totalTokens = lastCompletion?.totalTokens ?? promptTokens + completionTokens
  const tokensPerSecond = lastCompletion?.metrics?.tokens_per_second
  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

  const cards = [
    { label: 'Prompt tokens', value: promptTokens },
    { label: 'Completion tokens', value: completionTokens },
    { label: 'Total tokens', value: totalTokens },
    { label: 'Tokens / sec', value: tokensPerSecond ?? '–' },
    { label: 'Messages', value: sessionMetrics?.total_messages ?? 0 },
  ]

  return (
    <div className="grid gap-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <article key={card.label} className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-base)] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">{card.label}</p>
          <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
            {typeof card.value === 'number' ? numberFormatter.format(card.value) : card.value}
          </p>
        </article>
      ))}
      {isStreaming && (
        <div className="col-span-full rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-3 text-center text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
          Streaming in progress… metrics will finalize once the model completes.
        </div>
      )}
    </div>
  )
}
