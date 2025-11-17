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
  variant?: 'default' | 'minimal'
}

export function ModelSelector({ selectedModel, disabled, onSelect, onClear, variant = 'default' }: ModelSelectorProps) {
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

  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 text-[color:var(--text-muted)]">
        <select
          className="min-w-[120px] border border-[color:var(--border-strong)] bg-transparent px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={selectedModel ?? 'none'}
          onChange={(event) => {
            const next = event.target.value
            if (next === 'none') {
              onClear()
              return
            }
            void handleLoad(next)
          }}
          disabled={busyModel !== null || disabled}
        >
          <option value="none">none</option>
          {options.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="flex size-7 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)] disabled:opacity-40"
          onClick={() => {
            void refresh()
          }}
          disabled={status === 'loading'}
          title="Scan"
        >
          <RefreshCw className={clsx('size-4', status === 'loading' && 'animate-spin')} />
          <span className="sr-only">Scan models</span>
        </button>
        <button
          type="button"
          className="flex size-7 items-center justify-center border border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)] disabled:opacity-40"
          onClick={() => {
            void handleUnload()
          }}
          disabled={!selectedModel || busyModel !== null}
          title="Eject"
        >
          <LogOut className="size-4" />
          <span className="sr-only">Eject model</span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col">
          <span>Loaded model</span>
          <select
            className="mt-2 min-w-[220px] border border-[color:var(--border-strong)] bg-transparent px-3 py-2 text-sm text-[color:var(--text-primary)]"
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
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            className="border border-[color:var(--border-strong)] px-3 py-2 tracking-[0.35em] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)] disabled:opacity-40"
            onClick={() => {
              void refresh()
            }}
            disabled={status === 'loading'}
          >
            <RefreshCw className={clsx('mr-1 inline size-4', status === 'loading' && 'animate-spin')} />
            Scan
          </button>
          <button
            type="button"
            className="border border-[color:var(--border-strong)] px-3 py-2 tracking-[0.35em] text-[color:var(--text-muted)] hover:text-[color:var(--accent-primary)] disabled:opacity-40"
            onClick={() => {
              void handleUnload()
            }}
            disabled={!selectedModel || busyModel !== null}
          >
            <LogOut className="mr-1 inline size-4" />
            Eject
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
        {busyModel ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Contacting {busyModel}…</span>
          </>
        ) : (
          <span>{message ?? (selectedModel ? `Using ${selectedModel}` : 'No model loaded')}</span>
        )}
      </div>
    </div>
  )
}
