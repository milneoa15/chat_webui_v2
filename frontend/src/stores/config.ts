import { api, type ConfigRead } from '@/api/client'
import { create } from 'zustand'

export type ThemeOption = 'graphite' | 'terminal' | 'solarized' | 'quartz'

export const themePresets: Record<ThemeOption, { label: string; description: string }> = {
  graphite: { label: 'Dark Graphite', description: 'Low-glare interface tuned for focus.' },
  terminal: { label: 'Terminal Green', description: 'Retro phosphor glow and high contrast.' },
  solarized: { label: 'Solarized Dark', description: 'Balanced palette for long sessions.' },
  quartz: { label: 'Light Quartz', description: 'Soft light theme for bright spaces.' },
}

const THEME_STORAGE_KEY = 'chatbot.theme.preferred'
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

type ConfigState = {
  config?: ConfigRead
  theme: ThemeOption
  status: 'idle' | 'loading' | 'error'
  error?: string
  hasLoaded: boolean
  loadConfig: (force?: boolean) => Promise<void>
  updateTheme: (theme: ThemeOption) => Promise<void>
  updateOllamaBaseUrl: (url: string) => Promise<void>
  resetError: () => void
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: undefined,
  theme: readStoredTheme(),
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
  resetError() {
    if (get().error) {
      set({ error: undefined })
    }
  },
}))
