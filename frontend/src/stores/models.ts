import { api, type ModelListResponse, type ModelSummary } from '@/api/client'
import { create } from 'zustand'

type ModelsState = {
  models: ModelSummary[]
  stats?: ModelListResponse['stats']
  lastRefreshed?: string | null
  status: 'idle' | 'loading' | 'error'
  error?: string
  refresh: () => Promise<void>
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const useModelsStore = create<ModelsState>((set) => ({
  models: [],
  stats: undefined,
  lastRefreshed: undefined,
  status: 'idle',
  error: undefined,
  async refresh() {
    set({ status: 'loading', error: undefined })
    try {
      const response = await api.models.list()
      set({
        models: response.items ?? [],
        stats: response.stats,
        lastRefreshed: response.last_refreshed,
        status: 'idle',
      })
    } catch (error) {
      set({
        status: 'error',
        error: errorMessage(error, 'Unable to load model catalog'),
      })
    }
  },
}))
