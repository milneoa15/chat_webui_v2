import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const queryClient = new QueryClient()

describe('App shell', () => {
  it('renders navigation links', () => {
    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>,
    )

    expect(screen.getByText(/Chatbot Web UI v2/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Models' })).toBeInTheDocument()
  })
})
