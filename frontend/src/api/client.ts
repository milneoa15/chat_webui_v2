import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export const apiClient = createClient<paths>({
  baseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

export type HealthResponse = components['schemas']['HealthResponse']
export type ConfigRead = components['schemas']['ConfigRead']
export type ConfigUpdate = components['schemas']['ConfigUpdate']
export type SessionRead = components['schemas']['SessionRead']
export type SessionListResponse = components['schemas']['SessionListResponse']
export type SessionCreate = components['schemas']['SessionCreate']
export type ModelSummary = components['schemas']['ModelSummary']
export type ModelListResponse = components['schemas']['ModelListResponse']

export class ApiError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
    if ('error' in error && typeof (error as { error?: { message?: string } }).error?.message === 'string') {
      return (error as { error?: { message?: string } }).error!.message!
    }
  }
  return fallback
}

function ensureData<T>(result: { data?: T; error?: unknown; response?: Response }, fallbackMessage: string): T {
  if (result.data !== undefined) {
    return result.data
  }
  const status = result.response?.status
  const message = parseErrorMessage(result.error, fallbackMessage)
  throw new ApiError(message, status, result.error)
}

export const api = {
  async health() {
    const result = await apiClient.GET('/api/health')
    return ensureData(result, 'Unable to load API health status')
  },
  config: {
    async read() {
      const result = await apiClient.GET('/api/config')
      return ensureData(result, 'Unable to load configuration')
    },
    async update(payload: ConfigUpdate) {
      const result = await apiClient.PUT('/api/config', {
        body: payload,
      })
      return ensureData(result, 'Unable to update configuration')
    },
  },
  sessions: {
    async list() {
      const result = await apiClient.GET('/api/sessions')
      return ensureData(result, 'Unable to load sessions')
    },
    async create(payload: SessionCreate) {
      const result = await apiClient.POST('/api/sessions', {
        body: payload,
      })
      return ensureData(result, 'Unable to create session')
    },
  },
  models: {
    async list() {
      const result = await apiClient.GET('/api/models')
      return ensureData(result, 'Unable to load models')
    },
  },
}
