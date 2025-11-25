import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { ModelSelector } from './ModelSelector'
import { useModelsStore } from '@/stores/models'

const initialState = useModelsStore.getState()

describe('ModelSelector', () => {
  beforeEach(() => {
    act(() => {
      useModelsStore.setState(initialState, true)
    })
  })

  afterEach(() => {
    act(() => {
      useModelsStore.setState(initialState, true)
    })
  })

  it('requests an initial model refresh exactly once on mount', async () => {
    const refreshMock = vi.fn().mockResolvedValue(undefined)

    act(() => {
      useModelsStore.setState(
        {
          ...initialState,
          models: [],
          status: 'idle',
          refresh: refreshMock,
        },
        true,
      )
    })

    render(
      <ModelSelector selectedModel={undefined} disabled={false} onSelect={() => {}} onClear={() => {}} />,
    )

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useModelsStore.setState(
        {
          ...useModelsStore.getState(),
          models: [],
          status: 'idle',
        },
        true,
      )
    })

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
    })
  })
})
