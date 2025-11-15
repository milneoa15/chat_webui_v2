import { useConfigStore } from '@/stores/config'
import { useState } from 'react'

export function SettingsPage() {
  const { apiBaseUrl, preferredTheme, setApiBaseUrl, setPreferredTheme } = useConfigStore()
  const [urlValue, setUrlValue] = useState(apiBaseUrl)

  return (
    <section className="space-y-6 rounded-2xl border border-graphite-700/60 bg-[#0b0b12] p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-graphite-500">General</p>
        <h2 className="text-2xl font-semibold">Environment</h2>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        Ollama Base URL
        <input
          className="rounded-xl border border-graphite-700 bg-transparent px-3 py-2 text-base"
          value={urlValue}
          onChange={(event) => setUrlValue(event.target.value)}
          onBlur={() => setApiBaseUrl(urlValue)}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        Theme preset
        <select
          className="rounded-xl border border-graphite-700 bg-[#13131c] px-3 py-2 text-base"
          value={preferredTheme}
          onChange={(event) => setPreferredTheme(event.target.value as typeof preferredTheme)}
        >
          <option value="graphite">Dark Graphite</option>
          <option value="terminal">Terminal Green</option>
          <option value="solarized">Solarized Dark</option>
          <option value="quartz">Light Quartz</option>
        </select>
      </label>
    </section>
  )
}
