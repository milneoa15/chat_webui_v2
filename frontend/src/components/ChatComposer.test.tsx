import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer } from './ChatComposer'
import type { GenerationDefaults } from '@/api/client'

const defaults: GenerationDefaults = {
  model: 'llama3',
  temperature: 0.7,
  top_p: 0.9,
  top_k: null,
  repeat_penalty: null,
  context_window: null,
  max_tokens: null,
  stop: [],
}

describe('ChatComposer', () => {
  it('submits prompt with overrides', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatComposer defaults={defaults} isStreaming={false} disabled={false} onSend={onSend} onCancel={vi.fn()} />)

    const textarea = screen.getByPlaceholderText(/ask anything/i)
    fireEvent.change(textarea, { target: { value: 'Hello assistant' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(onSend).toHaveBeenCalled())
    expect(onSend.mock.calls[0][0]).toMatchObject({ prompt: 'Hello assistant', model: 'llama3' })
  })
})
