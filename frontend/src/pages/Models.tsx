import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Database, Download, Play, RefreshCw, ServerCog, StopCircle, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { useModelsStore } from '@/stores/models'
import { useConfigStore } from '@/stores/config'

type PullState = {
  name: string
  status?: string
  progress?: number
  logs: string[]
}

export function ModelsPage() {
  const { config } = useConfigStore()
  const { models, stats, lastRefreshed, status, refresh, error } = useModelsStore()
  const [pullState, setPullState] = useState<PullState | null>(null)
  const [actionMessage, setActionMessage] = useState<string | undefined>()
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!models.length && status === 'idle') {
      void refresh()
    }
  }, [models.length, status, refresh])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh()
    }, 10000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  const summaryCards = useMemo(
    () => [
      {
        label: 'Cached models',
        value: models.length,
        meta: lastRefreshed ? `Updated ${new Date(lastRefreshed).toLocaleTimeString()}` : undefined,
      },
      { label: 'CPU', value: `${stats?.cpu_percent ?? 0}%` },
      { label: 'GPU', value: `${stats?.gpu_percent ?? 0}%` },
    ],
    [models.length, stats?.cpu_percent, stats?.gpu_percent, lastRefreshed],
  )

  const updateLogs = (name: string, chunk: Record<string, unknown>) => {
    setPullState((prev) => {
      if (!prev || prev.name !== name) {
        return prev
      }
      const completed = typeof chunk.completed === 'number' ? Number(chunk.completed) : undefined
      const total = typeof chunk.total === 'number' ? Number(chunk.total) : undefined
      const progress = completed && total ? Math.min(1, completed / Math.max(total, 1)) : prev.progress
      const status = typeof chunk.status === 'string' ? chunk.status : prev.status
      const detail = typeof chunk.detail === 'string' ? chunk.detail : status
      const nextLogs = detail ? [...prev.logs, detail].slice(-40) : prev.logs
      return {
        ...prev,
        progress,
        status,
        logs: nextLogs,
      }
    })
  }

  const handlePull = async (name: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setPullState({ name, status: 'Starting pull…', progress: 0, logs: [] })
    try {
      await api.models.pull({ name, stream: true }, (chunk) => updateLogs(name, chunk), controller.signal)
      setActionMessage(`Pull completed for ${name}`)
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        setActionMessage(err instanceof Error ? err.message : 'Pull failed')
      }
    } finally {
      controllerRef.current = null
      void refresh()
    }
  }

  const handleLoad = async (name: string) => {
    try {
      await api.models.load({ name })
      setActionMessage(`Loading ${name}… check Ollama logs for readiness`)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to load model')
    } finally {
      void refresh()
    }
  }

  const handleUnload = async (name: string) => {
    try {
      await api.models.unload({ name })
      setActionMessage(`Requested unload for ${name}`)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to unload model')
    } finally {
      void refresh()
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await api.models.delete(name)
      setActionMessage(`Deleted ${name}`)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Unable to delete model')
    } finally {
      void refresh()
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Ollama endpoint</p>
          <p className="text-lg font-semibold text-[color:var(--text-primary)]">{config?.ollama_base_url ?? 'Not configured'}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-muted)]"
          onClick={() => {
            void refresh()
          }}
        >
          <RefreshCw className="size-4" />
          Refresh catalog
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            {card.meta && <p className="text-xs text-[color:var(--text-muted)]">{card.meta}</p>}
          </article>
        ))}
      </div>

      {actionMessage && <p className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm text-[color:var(--text-muted)]">{actionMessage}</p>}
      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="space-y-3">
        {status === 'loading' && <p className="text-sm text-[color:var(--text-muted)]">Refreshing model catalog…</p>}
        {models.map((model) => (
          <article key={model.name} className="rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[color:var(--text-primary)]">{model.name}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
                  {model.size_mib ? `${(model.size_mib / 1024).toFixed(2)} GB` : 'Unknown size'} · digest {model.digest?.slice(0, 10) ?? 'n/a'}
                </p>
                {model.sessions.length > 0 && (
                  <p className="text-xs text-[color:var(--text-muted)]">Used by sessions: {model.sessions.join(', ')}</p>
                )}
                {model.warnings?.includes('model_not_loaded') && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200">
                    <AlertTriangle className="size-4" /> Active sessions require this model to be loaded.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-3 py-1">
                  <ServerCog className="size-4" />
                  {model.loaded ? 'Loaded' : model.pulled ? 'Pulled' : 'Not installed'}
                </span>
                <button className="rounded-full border border-[color:var(--border-strong)] px-3 py-2" onClick={() => handlePull(model.name)}>
                  <Download className="size-4" /> Pull
                </button>
                {model.loaded ? (
                  <button className="rounded-full border border-[color:var(--border-strong)] px-3 py-2" onClick={() => handleUnload(model.name)}>
                    <StopCircle className="size-4" /> Unload
                  </button>
                ) : (
                  <button className="rounded-full border border-[color:var(--border-strong)] px-3 py-2" onClick={() => handleLoad(model.name)}>
                    <Play className="size-4" /> Load
                  </button>
                )}
                <button className="rounded-full border border-red-400/40 px-3 py-2 text-red-200" onClick={() => handleDelete(model.name)}>
                  <Trash2 className="size-4" /> Delete
                </button>
              </div>
            </div>
            {pullState?.name === model.name && (
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-[color:var(--surface-panel)]">
                  <div
                    className="h-2 rounded-full bg-[color:var(--accent-primary)] transition-all"
                    style={{ width: `${Math.round((pullState.progress ?? 0) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">{pullState.status ?? 'Downloading…'}</p>
              </div>
            )}
          </article>
        ))}
        {!models.length && status === 'idle' && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-5 text-center text-sm text-[color:var(--text-muted)]">
            No models cached yet. Pull one from the catalog to see it here.
          </div>
        )}
      </div>

      {pullState && (
        <div className="space-y-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Pulling {pullState.name}</p>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-3 py-1 text-xs"
              onClick={() => {
                controllerRef.current?.abort()
                setPullState(null)
              }}
            >
              Cancel pull
            </button>
          </div>
          <div className="h-32 overflow-y-auto rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-3 font-mono text-xs text-[color:var(--text-muted)]">
            {pullState.logs.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
        <Database className="size-4" /> Model catalog polls every 10 seconds; pull progress streams live.
      </p>
    </section>
  )
}
