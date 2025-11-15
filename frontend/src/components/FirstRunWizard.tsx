import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { useConfigStore } from '@/stores/config'

const STORAGE_KEY = 'chatbot.setup.complete'

export function FirstRunWizard() {
  const { config, hasLoaded, updateOllamaBaseUrl } = useConfigStore()
  const [open, setOpen] = useState(false)
  const [endpoint, setEndpoint] = useState(config?.ollama_base_url ?? '')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [version, setVersion] = useState<string | undefined>()

  useEffect(() => {
    setEndpoint(config?.ollama_base_url ?? '')
  }, [config?.ollama_base_url])

  useEffect(() => {
    if (!hasLoaded) return
    const alreadyCompleted = window.localStorage.getItem(STORAGE_KEY)
    if (alreadyCompleted === '1') return
    setOpen(true)
  }, [hasLoaded])

  const handleVerify = async () => {
    setTesting(true)
    setError(undefined)
    try {
      if (endpoint && endpoint !== config?.ollama_base_url) {
        await updateOllamaBaseUrl(endpoint)
      }
      const response = await api.version()
      setVersion(response.version)
      window.localStorage.setItem(STORAGE_KEY, '1')
      setTimeout(() => setOpen(false), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Ollama')
    } finally {
      setTesting(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!version && !next) {
      return
    }
    setOpen(next)
  }

  if (!open) return null

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6 shadow-2xl">
          <Dialog.Title className="text-2xl font-semibold text-[color:var(--text-primary)]">First-run setup</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[color:var(--text-muted)]">
            Point the UI at your local Ollama instance. We will test the connection before letting you continue.
          </Dialog.Description>
          <div className="mt-6 space-y-4">
            <label className="text-sm text-[color:var(--text-primary)]">
              Ollama Base URL
              <input
                className="mt-2 w-full rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-4 py-3 text-lg text-[color:var(--text-primary)]"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="http://localhost:11434"
              />
            </label>
            <p className="text-xs text-[color:var(--text-muted)]">
              The backend stores this URL encrypted so only your browser and FastAPI server can read it.
            </p>
            {error && <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</p>}
            {version && (
              <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                Connected to Ollama {version}. You are ready to chat!
              </p>
            )}
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                void handleVerify()
              }}
              disabled={!endpoint || testing}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[color:var(--accent-primary)] px-5 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testing && <Loader2 className="size-4 animate-spin" />}
              Test & Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
