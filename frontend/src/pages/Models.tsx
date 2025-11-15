import { useConfigStore } from '@/stores/config'
import { Database, RefreshCw, ServerCog } from 'lucide-react'

const placeholderModels = [
  { name: 'llama3:8b', status: 'ready', size: '4.7 GB' },
  { name: 'mistral:7b', status: 'loading', size: '4.1 GB' },
]

export function ModelsPage() {
  const apiBaseUrl = useConfigStore((state) => state.apiBaseUrl)

  return (
    <section className="space-y-4 rounded-2xl border border-graphite-700/60 bg-[#09090f] p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-graphite-500">Ollama Endpoint</p>
          <p className="text-lg font-semibold">{apiBaseUrl}</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-graphite-600 px-4 py-2 text-sm font-medium hover:bg-graphite-800">
          <RefreshCw className="size-4" />Refresh Catalog
        </button>
      </header>

      <div className="space-y-3">
        {placeholderModels.map((model) => (
          <article key={model.name} className="flex items-center justify-between rounded-xl border border-graphite-700/50 px-5 py-4">
            <div>
              <p className="text-base font-semibold">{model.name}</p>
              <p className="text-xs uppercase tracking-widest text-graphite-400">{model.size}</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-graphite-300">
              <ServerCog className="size-5" />
              {model.status}
            </div>
          </article>
        ))}
      </div>

      <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-graphite-500">
        <Database className="size-4" /> Streaming pull and delete controls arrive in the next phase.
      </p>
    </section>
  )
}
