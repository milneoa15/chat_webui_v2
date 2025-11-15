import { useEffect } from 'react'
import { Database, RefreshCw, ServerCog } from 'lucide-react'
import { useModelsStore } from '@/stores/models'
import { useConfigStore } from '@/stores/config'

export function ModelsPage() {
  const { config } = useConfigStore()
  const { models, stats, lastRefreshed, status, refresh, error } = useModelsStore()

  useEffect(() => {
    if (!models.length && status === 'idle') {
      void refresh()
    }
  }, [models.length, status, refresh])

  return (
    <section className="space-y-4 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Ollama Endpoint</p>
          <p className="text-lg font-semibold text-[color:var(--text-primary)]">{config?.ollama_base_url ?? 'Not configured'}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-muted)]"
          onClick={() => {
            void refresh()
          }}
        >
          <RefreshCw className="size-4" />
          Refresh Catalog
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Cached Models</p>
          <p className="mt-2 text-2xl font-semibold">{models.length}</p>
          {lastRefreshed && <p className="text-xs text-[color:var(--text-muted)]">Updated {new Date(lastRefreshed).toLocaleTimeString()}</p>}
        </article>
        <article className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">CPU</p>
          <p className="mt-2 text-2xl font-semibold">{stats?.cpu_percent ?? 0}%</p>
        </article>
        <article className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">GPU</p>
          <p className="mt-2 text-2xl font-semibold">{stats?.gpu_percent ?? 0}%</p>
        </article>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      <div className="space-y-3">
        {status === 'loading' && <p className="text-sm text-[color:var(--text-muted)]">Refreshing model catalog…</p>}
        {models.map((model) => (
          <article
            key={model.name}
            className="flex items-center justify-between rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-5 py-4"
          >
            <div>
              <p className="text-base font-semibold text-[color:var(--text-primary)]">{model.name}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
                {model.size_mib ? `${(model.size_mib / 1024).toFixed(2)} GB` : 'Unknown size'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-[color:var(--text-muted)]">
              <ServerCog className="size-5" />
              {model.loaded ? 'Loaded' : model.pulled ? 'Pulled' : 'Pending'}
            </div>
          </article>
        ))}
        {!models.length && status === 'idle' && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-5 text-center text-sm text-[color:var(--text-muted)]">
            No models cached yet. Pull one from the catalog to see it here.
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
        <Database className="size-4" /> Streaming pull and delete controls arrive in the next phase.
      </p>
    </section>
  )
}
