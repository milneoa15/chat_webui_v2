import { useEffect, useMemo, useState } from 'react'
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { api } from '@/api/client'
import { useConfigStore, themePresets, type ThemeOption } from '@/stores/config'

const generalSchema = z.object({
  endpoint: z.string().url('Enter a valid URL'),
})

const generationSchema = z.object({
  model: z.string().min(1, 'Model name is required'),
  temperature: z.coerce.number().min(0).max(2),
  top_p: z.coerce.number().min(0).max(1),
  top_k: z.string().optional(),
  repeat_penalty: z.string().optional(),
  context_window: z.string().optional(),
  max_tokens: z.string().optional(),
  stop: z.string().optional(),
})

type GenerationFormValues = z.infer<typeof generationSchema>

export function SettingsPage() {
  const {
    config,
    updateOllamaBaseUrl,
    updateGenerationDefaults,
    theme,
    updateTheme,
    error,
    resetError,
    appearance,
    updateAppearance,
    loadConfig,
    thinkingEnabled,
    setThinkingEnabled,
  } =
    useConfigStore()
  const [activeTab, setActiveTab] = useState<'general' | 'generation' | 'appearance' | 'advanced'>('general')
  const [testStatus, setTestStatus] = useState<string | undefined>()
  const [feedback, setFeedback] = useState<string | undefined>()
  const generationDefaults = config?.generation_defaults

  const generalForm = useForm<z.infer<typeof generalSchema>>({
    resolver: zodResolver(generalSchema),
    defaultValues: { endpoint: config?.ollama_base_url ?? '' },
  })

  const generationForm = useForm<GenerationFormValues>({
    resolver: zodResolver(generationSchema) as Resolver<GenerationFormValues>,
    defaultValues: {
      model: generationDefaults?.model ?? '',
      temperature: generationDefaults?.temperature ?? 0.7,
      top_p: generationDefaults?.top_p ?? 0.9,
      top_k: generationDefaults?.top_k?.toString() ?? '',
      repeat_penalty: generationDefaults?.repeat_penalty?.toString() ?? '',
      context_window: generationDefaults?.context_window?.toString() ?? '',
      max_tokens: generationDefaults?.max_tokens?.toString() ?? '',
      stop: (generationDefaults?.stop ?? []).join('\n'),
    },
  })

  useEffect(() => {
    generalForm.reset({ endpoint: config?.ollama_base_url ?? '' })
  }, [config?.ollama_base_url, generalForm])

  useEffect(() => {
    const defaults = generationDefaults
    if (!defaults) return
    generationForm.reset({
      model: defaults.model,
      temperature: defaults.temperature,
      top_p: defaults.top_p,
      top_k: defaults.top_k?.toString() ?? '',
      repeat_penalty: defaults.repeat_penalty?.toString() ?? '',
      context_window: defaults.context_window?.toString() ?? '',
      max_tokens: defaults.max_tokens?.toString() ?? '',
      stop: (defaults.stop ?? []).join('\n'),
    })
  }, [generationDefaults, generationForm])

  const handleGeneralSubmit = async (values: z.infer<typeof generalSchema>) => {
    await updateOllamaBaseUrl(values.endpoint)
    setFeedback('Endpoint saved')
  }

  const endpointField = generalForm.register('endpoint')

  const handleGenerationSubmit: SubmitHandler<GenerationFormValues> = async (values) => {
    const toNumber = (value?: string) => {
      if (!value) return undefined
      const parsed = Number(value)
      return Number.isNaN(parsed) ? undefined : parsed
    }
    await updateGenerationDefaults({
      model: values.model,
      temperature: values.temperature,
      top_p: values.top_p,
      top_k: toNumber(values.top_k),
      repeat_penalty: toNumber(values.repeat_penalty),
      context_window: toNumber(values.context_window),
      max_tokens: toNumber(values.max_tokens),
      stop: values.stop ? values.stop.split(/\n|,/).map((entry) => entry.trim()).filter(Boolean) : [],
    })
    setFeedback('Generation defaults updated')
  }

  const handleTestConnection = async () => {
    setTestStatus('Testing connection…')
    try {
      const response = await api.version()
      setTestStatus(`Connected to Ollama ${response.version}`)
    } catch (err) {
      setTestStatus(err instanceof Error ? err.message : 'Unable to reach Ollama')
    }
  }

  const handleThemeSelect = (nextTheme: ThemeOption) => {
    if (nextTheme === theme) return
    void updateTheme(nextTheme)
  }

  const handleDensityChange = (density: 'comfortable' | 'compact') => {
    updateAppearance({ density })
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'generation', label: 'Generation Defaults' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'advanced', label: 'Advanced' },
  ]

  const appearanceSummary = useMemo(() => `${Math.round(appearance.fontScale * 100)}% font scale · ${appearance.density}`, [appearance.fontScale, appearance.density])

  return (
    <section className="flex flex-col gap-6 text-sm text-[color:var(--text-primary)]">
      <header className="border-b border-[color:var(--border-strong)]/60 pb-4">
        <h2 className="text-2xl font-semibold text-[color:var(--accent-primary)]">Workspace settings</h2>
        <p className="text-sm text-[color:var(--text-muted)]">Configure Ollama, defaults, and the interface theme.</p>
      </header>

      <nav className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-muted)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={clsx(
              'border border-[color:var(--border-strong)] px-3 py-2 transition hover:text-[color:var(--accent-primary)]',
              activeTab === tab.id && 'text-[color:var(--accent-primary)]',
            )}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {feedback && <p className="border border-[color:var(--border-strong)]/60 bg-[color:var(--surface-panel)]/40 px-4 py-2 text-xs text-[color:var(--text-muted)]">{feedback}</p>}

      {activeTab === 'general' && (
        <form className="space-y-4" onSubmit={generalForm.handleSubmit(handleGeneralSubmit)}>
          <label className="flex flex-col gap-2 text-sm text-[color:var(--text-primary)]">
            Ollama base URL
            <input
              className="border border-[color:var(--border-strong)] bg-transparent px-3 py-2 text-base text-[color:var(--text-primary)] transition focus:border-[color:var(--accent-primary)]"
              placeholder="http://localhost:11434"
              {...endpointField}
              onChange={(event) => {
                if (error) resetError()
                endpointField.onChange(event)
              }}
            />
            {generalForm.formState.errors.endpoint && <span className="text-xs text-red-300">{generalForm.formState.errors.endpoint.message}</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-full bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-black">
              Save endpoint
            </button>
            <button type="button" className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm" onClick={() => void handleTestConnection()}>
              Test connection
            </button>
            {testStatus && <span className="text-sm text-[color:var(--text-muted)]">{testStatus}</span>}
          </div>
        </form>
      )}

      {activeTab === 'generation' && (
        <form className="space-y-4" onSubmit={generationForm.handleSubmit(handleGenerationSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[color:var(--text-primary)]">
              Default model
              <input className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('model')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Temperature
              <input type="number" step="0.05" min={0} max={2} className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('temperature')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Top P
              <input type="number" step="0.05" min={0} max={1} className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('top_p')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Top K
              <input type="number" min={1} className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('top_k')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Repeat penalty
              <input type="number" min={0} step={0.1} className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('repeat_penalty')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Context window
              <input type="number" min={256} step={256} className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('context_window')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Max tokens
              <input type="number" min={1} className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" {...generationForm.register('max_tokens')} />
            </label>
            <label className="text-sm text-[color:var(--text-primary)]">
              Stop sequences
              <textarea className="mt-2 w-full border border-[color:var(--border-strong)] bg-transparent px-3 py-2" rows={3} placeholder="One per line" {...generationForm.register('stop')} />
            </label>
          </div>
          <button type="submit" className="rounded-full bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-black">
            Save defaults
          </button>
        </form>
      )}

      {activeTab === 'appearance' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.keys(themePresets) as ThemeOption[]).map((presetKey) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => handleThemeSelect(presetKey)}
                className={clsx(
                  'rounded-2xl border px-4 py-3 text-left transition',
                  theme === presetKey ? 'border-[color:var(--accent-primary)] text-[color:var(--accent-primary)]' : 'border-[color:var(--border-strong)] text-[color:var(--text-muted)]',
                )}
              >
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{themePresets[presetKey].label}</p>
                <p className="text-xs text-[color:var(--text-muted)]">{themePresets[presetKey].description}</p>
              </button>
            ))}
          </div>
          <label className="block text-sm text-[color:var(--text-primary)]">
            Font scale ({Math.round(appearance.fontScale * 100)}%)
            <input
              type="range"
              min={0.9}
              max={1.2}
              step={0.01}
              value={appearance.fontScale}
              onChange={(event) => updateAppearance({ fontScale: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <div className="flex flex-wrap gap-3 text-sm text-[color:var(--text-primary)]">
            <button
              type="button"
              onClick={() => handleDensityChange('comfortable')}
              className={clsx('rounded-full border px-4 py-2', appearance.density === 'comfortable' ? 'border-[color:var(--accent-primary)]' : 'border-[color:var(--border-strong)]')}
            >
              Comfortable spacing
            </button>
            <button
              type="button"
              onClick={() => handleDensityChange('compact')}
              className={clsx('rounded-full border px-4 py-2', appearance.density === 'compact' ? 'border-[color:var(--accent-primary)]' : 'border-[color:var(--border-strong)]')}
            >
              Compact spacing
            </button>
          </div>
          <p className="text-xs text-[color:var(--text-muted)]">{appearanceSummary}</p>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)]/40 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[color:var(--accent-primary)]"
              checked={thinkingEnabled}
              onChange={(event) => setThinkingEnabled(event.target.checked)}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">Show reasoning traces (if model supports thinking)</span>
              <p className="text-xs text-[color:var(--text-muted)]">
                When enabled, thinking models emit their reasoning separately. The assistant transcript reveals this text by default and streams it live.
              </p>
            </div>
          </label>
          <p className="text-sm text-[color:var(--text-muted)]">Streaming heartbeat is fixed at 8 seconds. Prompt history is capped at 200 messages per session.</p>
          <button
            type="button"
            className="rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-sm"
            onClick={() => {
              void loadConfig(true)
              setFeedback('Reloaded config from backend')
            }}
          >
            Force reload configuration
          </button>
        </div>
      )}

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    </section>
  )
}
