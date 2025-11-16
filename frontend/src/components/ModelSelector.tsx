import { useEffect, useMemo, useState } from 'react'
import { LogOut, Loader2, RefreshCw } from 'lucide-react'
import { api } from '@/api/client'
import { useModelsStore } from '@/stores/models'
import clsx from 'clsx'

export type ModelSelectorProps = {
  selectedModel?: string
  disabled?: boolean
  onSelect: (model: string) => void
  onClear: () => void
}

export function ModelSelector({ selectedModel, disabled, onSelect, onClear }: ModelSelectorProps) {
  const { models, status, refresh } = useModelsStore()
  const [busyModel, setBusyModel] = useState<string | null>(null)
  const [message, setMessage] = useState<string | undefined>()

  useEffect(() => {
    if (!models.length && status === 'idle') {
      void refresh()
    }
  }, [models.length, status, refresh])

  const options = useMemo(() => {
    return [...models].sort((a, b) => {
      if (a.loaded === b.loaded) {
        return a.name.localeCompare(b.name)
      }
      return a.loaded ? -1 : 1
    })
  }, [models])

  const handleLoad = async (name: string) => {
    setBusyModel(name)
    setMessage(undefined)
    try {
      await api.models.load({ name })
      setMessage(`Loaded ${name}`)
      onSelect(name)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load model')
    } finally {
      setBusyModel(null)
      void refresh()
    }
  }

  const handleUnload = async () => {
    if (!selectedModel) return
    setBusyModel(selectedModel)
    setMessage(undefined)
    try {
      await api.models.unload({ name: selectedModel })
      setMessage(`Unloaded ${selectedModel}`)
      onClear()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to unload model')
    } finally {
      setBusyModel(null)
      void refresh()
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-1 flex-col text-xs uppercase tracking-[0.4em] text-[color:var(--text-muted)]">
          Model
          <select
            className="mt-2 w-full rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
            value={selectedModel ?? ''}
            onChange={(event) => {
              const next = event.target.value
              if (next) {
                void handleLoad(next)
              }
            }}
            disabled={busyModel !== null || disabled}
          >
            <option value="" disabled>
              {options.length ? 'Choose a model to load' : 'No models available'}
            </option>
            {options.map((model) => (
              <option key={model.name} value={model.name}>
                {model.loaded ? '[loaded]' : '[idle]'} {model.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-3 py-2 text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]"
          onClick={() => {
            void refresh()
          }}
          disabled={status === 'loading'}
        >
          <RefreshCw className={clsx('size-4', status === 'loading' && 'animate-spin')} />
          Scan
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-3 py-2 text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)] disabled:opacity-40"
          onClick={() => {
            void handleUnload()
          }}
          disabled={!selectedModel || busyModel !== null}
        >
          <LogOut className="size-4" />
          Eject
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
        {busyModel ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Contacting {busyModel}...</span>
          </>
        ) : (
          message && <span>{message}</span>
        )}
      </div>
    </div>
  )
}
