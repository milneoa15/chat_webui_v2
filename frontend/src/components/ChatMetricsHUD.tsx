import type { SessionMetricsResponse } from '@/api/client'
import type { StreamingState } from '@/hooks/useChatSession'

export type ChatMetricsHUDProps = {
  lastCompletion?: StreamingState
  sessionMetrics?: SessionMetricsResponse
  isStreaming: boolean
}

export function ChatMetricsHUD({ lastCompletion, sessionMetrics, isStreaming }: ChatMetricsHUDProps) {
  const safeMetric = (value: unknown, fallback = 0) => (typeof value === 'number' ? value : fallback)
  const promptTokens = lastCompletion?.promptTokens ?? safeMetric(sessionMetrics?.total_prompt_tokens)
  const completionTokens = lastCompletion?.completionTokens ?? safeMetric(sessionMetrics?.total_completion_tokens)
  const totalTokens = lastCompletion?.totalTokens ?? promptTokens + completionTokens
  const tokensPerSecond = lastCompletion?.metrics?.tokens_per_second
  const tokensPerSecondValue = typeof tokensPerSecond === 'number' ? tokensPerSecond : undefined
  const totalMessages = typeof sessionMetrics?.total_messages === 'number' ? sessionMetrics.total_messages : 0
  const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

  type MetricCard = { label: string; value: string | number }
  const cards: MetricCard[] = [
    { label: 'Prompt tokens', value: promptTokens },
    { label: 'Completion tokens', value: completionTokens },
    { label: 'Total tokens', value: totalTokens },
    { label: 'Tokens / sec', value: tokensPerSecondValue ?? '–' },
    { label: 'Messages', value: totalMessages },
  ]

  return (
    <div className="grid gap-3 border border-[color:var(--border-strong)]/60 bg-[color:var(--surface-panel)]/30 p-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <article key={card.label} className="border border-[color:var(--border-strong)]/60 bg-[color:var(--surface-base)]/60 p-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-muted)]">{card.label}</p>
          <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
            {typeof card.value === 'number' ? numberFormatter.format(card.value) : card.value}
          </p>
        </article>
      ))}
      {isStreaming && (
        <div className="col-span-full border border-dashed border-[color:var(--border-strong)]/60 bg-[color:var(--surface-muted)]/40 p-3 text-center text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
          Streaming in progress… metrics will finalize once the model completes.
        </div>
      )}
    </div>
  )
}
