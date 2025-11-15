import { RocketIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '@/services/api'

const sampleParameters = [
  { label: 'Temperature', value: '0.8' },
  { label: 'Top P', value: '0.9' },
  { label: 'Max Tokens', value: '4096' },
]

export function ChatPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchOnWindowFocus: false,
  })

  const statusLabel = useMemo(() => {
    if (isLoading) return 'Checking backend health…'
    if (error) return 'Backend unreachable'
    return data?.status === 'ok' ? 'Backend ready' : 'Unknown status'
  }, [data?.status, error, isLoading])

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-graphite-700/60 bg-[#10101a] p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-graphite-400">Active session</p>
          <h1 className="text-3xl font-semibold">Terminal Studio</h1>
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-full border border-graphite-600 px-4 py-2 text-sm font-medium text-graphite-100 hover:bg-graphite-800"
        >
          Re-run Health Check
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-graphite-700/50 p-4">
          <p className="text-xs uppercase tracking-wide text-graphite-400">Backend</p>
          <p className="mt-2 text-lg font-semibold">{statusLabel}</p>
        </article>
        {sampleParameters.map((parameter) => (
          <article key={parameter.label} className="rounded-xl border border-graphite-700/50 p-4">
            <p className="text-xs uppercase tracking-wide text-graphite-400">{parameter.label}</p>
            <p className="mt-2 text-lg font-semibold">{parameter.value}</p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-graphite-600/70 p-6 text-center">
        <RocketIcon className="mx-auto size-12 text-graphite-400" />
        <p className="mt-4 text-lg font-medium">
          Conversation streaming pipeline coming next. Connect to Ollama and start chatting when backend modules are ready.
        </p>
      </div>
    </section>
  )
}
