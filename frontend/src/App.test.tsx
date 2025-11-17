import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { api, type HealthResponse } from '@/api/client'

const buildHealthResponse = (): HealthResponse => ({
  status: 'ok',
  db_status: 'ok',
  ollama_status: 'ok',
  scheduler_status: 'running',
  cached_model_count: 0,
  uptime_seconds: 12,
  timestamp: new Date().toISOString(),
  version: '0.1.0',
})

describe('App shell', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders navigation links once health check succeeds', async () => {
    vi.spyOn(api, 'health').mockResolvedValue(buildHealthResponse())
    window.localStorage.setItem('chatbot.setup.complete', '1')
    const queryClient = new QueryClient()

    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>,
    )

    await waitFor(() => expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Models' })).toBeInTheDocument()
  })
})
