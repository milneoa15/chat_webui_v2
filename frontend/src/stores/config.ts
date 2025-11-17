import { api, type ConfigRead, type GenerationDefaults } from '@/api/client'
import { create } from 'zustand'

export type ThemeOption = 'graphite' | 'terminal' | 'solarized' | 'quartz'
export type DensityOption = 'comfortable' | 'compact'
type AppearancePreferences = {
  fontScale: number
  density: DensityOption
}

export const themePresets: Record<ThemeOption, { label: string; description: string }> = {
  graphite: { label: 'Dark Graphite', description: 'Low-glare interface tuned for focus.' },
  terminal: { label: 'Terminal Green', description: 'Retro phosphor glow and high contrast.' },
  solarized: { label: 'Solarized Dark', description: 'Balanced palette for long sessions.' },
  quartz: { label: 'Light Quartz', description: 'Soft light theme for bright spaces.' },
}

const THEME_STORAGE_KEY = 'chatbot.theme.preferred'
const APPEARANCE_STORAGE_KEY = 'chatbot.appearance.preferences'
const THINKING_STORAGE_KEY = 'chatbot.features.thinking'
const THEME_OPTIONS: ThemeOption[] = ['graphite', 'terminal', 'solarized', 'quartz']

const isThemeOption = (value: unknown): value is ThemeOption => THEME_OPTIONS.includes(value as ThemeOption)

const readStoredTheme = (): ThemeOption => {
  if (typeof window === 'undefined') {
    return 'graphite'
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeOption(stored) ? stored : 'graphite'
}

const persistTheme = (theme: ThemeOption) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }
}

const readAppearance = (): AppearancePreferences => {
  if (typeof window === 'undefined') {
    return { fontScale: 1, density: 'comfortable' }
  }
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!stored) return { fontScale: 1, density: 'comfortable' }
    const parsed = JSON.parse(stored) as AppearancePreferences
    if (!parsed.fontScale || (parsed.density !== 'comfortable' && parsed.density !== 'compact')) {
      return { fontScale: 1, density: 'comfortable' }
    }
    return parsed
  } catch (error) {
    console.warn('Unable to parse appearance preferences', error)
    return { fontScale: 1, density: 'comfortable' }
  }
}

const persistAppearance = (prefs: AppearancePreferences) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs))
  }
}

const readThinkingPreference = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  const stored = window.localStorage.getItem(THINKING_STORAGE_KEY)
  return stored === 'true'
}

const persistThinkingPreference = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THINKING_STORAGE_KEY, String(enabled))
  }
}

const applyAppearance = (prefs: AppearancePreferences) => {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.style.setProperty('--font-scale', prefs.fontScale.toString())
  document.documentElement.dataset.density = prefs.density
}

type ConfigState = {
  config?: ConfigRead
  theme: ThemeOption
  appearance: AppearancePreferences
  thinkingEnabled: boolean
  status: 'idle' | 'loading' | 'error'
  error?: string
  hasLoaded: boolean
  loadConfig: (force?: boolean) => Promise<void>
  updateTheme: (theme: ThemeOption) => Promise<void>
  updateOllamaBaseUrl: (url: string) => Promise<void>
  updateGenerationDefaults: (defaults: GenerationDefaults) => Promise<void>
  updateAppearance: (prefs: Partial<AppearancePreferences>) => void
  setThinkingEnabled: (enabled: boolean) => void
  resetError: () => void
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: undefined,
  theme: readStoredTheme(),
  appearance: readAppearance(),
  thinkingEnabled: readThinkingPreference(),
  status: 'idle',
  error: undefined,
  hasLoaded: false,
  async loadConfig(force = false) {
    if (get().status === 'loading') {
      return
    }
    if (get().hasLoaded && !force) {
      return
    }
    set({ status: 'loading', error: undefined })
    try {
      const config = await api.config.read()
      set({ config, status: 'idle', hasLoaded: true })
      if (config.theme && isThemeOption(config.theme) && config.theme !== get().theme) {
        persistTheme(config.theme)
        set({ theme: config.theme })
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to load configuration',
      })
    }
  },
  async updateTheme(theme) {
    set({ theme })
    persistTheme(theme)
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme
    }
    try {
      const config = await api.config.update({ theme })
      set({ config, error: undefined })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unable to update theme preference',
      })
      throw error
    }
  },
  async updateOllamaBaseUrl(url) {
    try {
      const config = await api.config.update({ ollama_base_url: url })
      set({ config, error: undefined })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unable to update Ollama endpoint',
      })
      throw error
    }
  },
  async updateGenerationDefaults(defaults) {
    try {
      const config = await api.config.update({ generation_defaults: defaults })
      set({ config, error: undefined })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unable to update generation defaults',
      })
      throw error
    }
  },
  updateAppearance(prefs) {
    const next = { ...get().appearance, ...prefs }
    set({ appearance: next })
    persistAppearance(next)
    applyAppearance(next)
  },
  setThinkingEnabled(enabled) {
    set({ thinkingEnabled: enabled })
    persistThinkingPreference(enabled)
  },
  resetError() {
    if (get().error) {
      set({ error: undefined })
    }
  },
}))

if (typeof window !== 'undefined') {
  applyAppearance(readAppearance())
}
