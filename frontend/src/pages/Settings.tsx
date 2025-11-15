import { useEffect, useState } from 'react'
import { useConfigStore, themePresets, type ThemeOption } from '@/stores/config'

export function SettingsPage() {
  const { config, updateOllamaBaseUrl, theme, updateTheme, error, resetError } = useConfigStore()
  const [endpoint, setEndpoint] = useState(config?.ollama_base_url ?? '')

  useEffect(() => {
    setEndpoint(config?.ollama_base_url ?? '')
  }, [config?.ollama_base_url])

  const handleEndpointBlur = () => {
    if (!endpoint || endpoint === config?.ollama_base_url) {
      return
    }
    void updateOllamaBaseUrl(endpoint)
  }

  const handleThemeSelect = (nextTheme: ThemeOption) => {
    if (nextTheme === theme) {
      return
    }
    void updateTheme(nextTheme)
  }

  return (
    <section className="space-y-6 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">General</p>
        <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Environment</h2>
      </div>

      <label className="flex flex-col gap-2 text-sm text-[color:var(--text-primary)]">
        Ollama Base URL
        <input
          className="rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-3 py-2 text-base text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
          value={endpoint}
          onChange={(event) => {
            if (error) resetError()
            setEndpoint(event.target.value)
          }}
          onBlur={handleEndpointBlur}
          placeholder="http://localhost:11434"
        />
        <span className="text-xs text-[color:var(--text-muted)]">The backend uses this URL when speaking to Ollama.</span>
      </label>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--text-muted)]">Theme Presets</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(Object.keys(themePresets) as ThemeOption[]).map((presetKey) => (
            <button
              key={presetKey}
              type="button"
              onClick={() => handleThemeSelect(presetKey)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                theme === presetKey
                  ? 'border-[color:var(--accent-primary)] bg-[color:var(--surface-muted)]'
                  : 'border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] hover:border-[color:var(--accent-primary)]'
              }`}
            >
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">{themePresets[presetKey].label}</p>
              <p className="text-xs text-[color:var(--text-muted)]">{themePresets[presetKey].description}</p>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
    </section>
  )
}
