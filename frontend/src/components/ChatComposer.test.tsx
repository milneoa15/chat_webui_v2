import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatComposer } from './ChatComposer'

describe('ChatComposer', () => {
  it('submits prompt on enter key', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatComposer model="llama3" isStreaming={false} disabled={false} onSend={onSend} onCancel={vi.fn()} />)

    const textarea = screen.getByPlaceholderText(/^>$/)
    fireEvent.change(textarea, { target: { value: 'Hello assistant' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(onSend).toHaveBeenCalled())
    expect(onSend.mock.calls[0][0]).toMatchObject({ prompt: 'Hello assistant', model: 'llama3' })
  })
})
