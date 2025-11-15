import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockConfigResponse = (theme: string = 'graphite') => ({
  id: 1,
  ollama_base_url: 'http://localhost:11434',
  theme,
  generation_defaults: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const mockClient = (overrides?: { read?: () => Promise<unknown>; update?: () => Promise<unknown> }) => {
  const read = overrides?.read ?? (() => Promise.resolve(mockConfigResponse()))
  const update = overrides?.update ?? (() => Promise.resolve(mockConfigResponse()))
  vi.doMock('@/api/client', () => ({
    api: {
      config: {
        read,
        update,
      },
    },
  }))
  return { read, update }
}

describe('theme store', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('loads theme preference from localStorage', async () => {
    window.localStorage.setItem('chatbot.theme.preferred', 'terminal')
    mockClient()
    const { useConfigStore } = await import('./config')
    expect(useConfigStore.getState().theme).toBe('terminal')
  })

  it('persists theme changes and syncs backend', async () => {
    const update = vi.fn().mockResolvedValue(mockConfigResponse('solarized'))
    mockClient({ update })
    const { useConfigStore } = await import('./config')
    await useConfigStore.getState().updateTheme('solarized')

    expect(update).toHaveBeenCalledWith({ theme: 'solarized' })
    expect(window.localStorage.getItem('chatbot.theme.preferred')).toBe('solarized')
    expect(useConfigStore.getState().theme).toBe('solarized')
  })
})
