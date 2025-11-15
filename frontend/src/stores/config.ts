import { create } from 'zustand'

type ThemeOption = 'graphite' | 'terminal' | 'solarized' | 'quartz'

type ConfigState = {
  apiBaseUrl: string
  preferredTheme: ThemeOption
  setApiBaseUrl: (url: string) => void
  setPreferredTheme: (theme: ThemeOption) => void
}

export const useConfigStore = create<ConfigState>((set) => ({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  preferredTheme: 'graphite',
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setPreferredTheme: (preferredTheme) => set({ preferredTheme }),
}))
