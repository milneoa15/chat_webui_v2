import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FirstRunWizard } from './FirstRunWizard'
import { useConfigStore } from '@/stores/config'
import { api, type ConfigRead } from '@/api/client'

const defaultsConfig: ConfigRead = {
  id: 1,
  ollama_base_url: 'http://localhost:11434',
  generation_defaults: {
    model: 'llama3',
    temperature: 0.7,
    top_p: 0.9,
    top_k: null,
    repeat_penalty: null,
    context_window: null,
    max_tokens: null,
    stop: [],
  },
  theme: 'graphite',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('FirstRunWizard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useConfigStore.setState((state) => ({
      ...state,
      config: defaultsConfig,
      hasLoaded: true,
      updateOllamaBaseUrl: vi.fn().mockResolvedValue(undefined),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves endpoint and verifies Ollama version', async () => {
    vi.spyOn(api, 'version').mockResolvedValue({ version: '0.2.0' })
    render(<FirstRunWizard />)

    await waitFor(() => expect(screen.getByText(/First-run setup/i)).toBeInTheDocument())
    const input = screen.getByLabelText(/Ollama Base URL/i)
    fireEvent.change(input, { target: { value: 'http://localhost:11434' } })
    fireEvent.click(screen.getByRole('button', { name: /Test & Save/i }))

    await waitFor(() => expect(api.version).toHaveBeenCalled())
    expect(window.localStorage.getItem('chatbot.setup.complete')).toBe('1')
  })
})
