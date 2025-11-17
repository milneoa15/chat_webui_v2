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
export type GenerationDefaults = components['schemas']['GenerationDefaults']
export type SessionRead = components['schemas']['SessionRead']
export type SessionListResponse = components['schemas']['SessionListResponse']
export type SessionCreate = components['schemas']['SessionCreate']
export type SessionUpdate = components['schemas']['SessionUpdate']
export type SessionMetricsResponse = components['schemas']['SessionMetricsResponse']
export type ModelSummary = components['schemas']['ModelSummary']
export type ModelListResponse = components['schemas']['ModelListResponse']
export type MessageRead = components['schemas']['MessageRead']
export type MessageListResponse = components['schemas']['MessageListResponse']
export type MessagePinRequest = components['schemas']['MessagePinRequest']
export type MessageRegenerateResponse = components['schemas']['MessageRegenerateResponse']
export type ChatRequest = components['schemas']['ChatRequest']
export type ModelActionResponse = components['schemas']['ModelActionResponse']
export type ModelPullRequest = components['schemas']['ModelPullRequest']
export type ModelNameRequest = components['schemas']['ModelNameRequest']
export type VersionResponse = components['schemas']['VersionResponse']

export type ChatChunkEvent = {
  type: 'chunk'
  content: string
  thinking?: string
}

export type ChatCompletionEvent = {
  type: 'complete'
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  metrics?: Record<string, unknown>
}

export type ChatStatusEvent = {
  type: 'status'
  message: string
}

export type ChatHeartbeatEvent = {
  type: 'heartbeat'
}

export type ChatErrorEvent = {
  type: 'error'
  message: string
}

export type ChatStreamEvent = ChatChunkEvent | ChatCompletionEvent | ChatStatusEvent | ChatHeartbeatEvent | ChatErrorEvent

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

async function streamSSE<T>(path: string, body: unknown, onEvent: (event: T) => void, signal?: AbortSignal) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new ApiError(detail || 'Streaming request failed', response.status)
  }
  if (!response.body) {
    throw new ApiError('Streaming not supported in this environment')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const chunk of events) {
        const lines = chunk.split('\n').map((line) => line.trim())
        for (const line of lines) {
          if (!line || line.startsWith(':')) {
            continue
          }
          if (line.startsWith('data:')) {
            const payload = line.replace(/^data:\s*/, '')
            if (!payload) {
              continue
            }
            try {
              const parsed = JSON.parse(payload) as T
              onEvent(parsed)
            } catch (error) {
              console.warn('Unable to parse SSE payload', error)
            }
          }
        }
      }
    }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return
    }
    throw error
  } finally {
    reader.releaseLock()
  }
}

export const api = {
  async health() {
    const result = await apiClient.GET('/api/health')
    return ensureData(result, 'Unable to load API health status')
  },
  async version() {
    const result = await apiClient.GET('/api/version')
    return ensureData(result, 'Unable to reach Ollama')
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
    async rename(sessionId: number, payload: SessionUpdate) {
      const result = await apiClient.PATCH('/api/sessions/{session_id}', {
        params: {
          path: {
            session_id: sessionId,
          },
        },
        body: payload,
      })
      return ensureData(result, 'Unable to rename session')
    },
    async delete(sessionId: number) {
      const result = await apiClient.DELETE('/api/sessions/{session_id}', {
        params: {
          path: {
            session_id: sessionId,
          },
        },
      })
      if (result.error) {
        throw new ApiError(parseErrorMessage(result.error, 'Unable to delete session'), result.response?.status)
      }
    },
    async metrics(sessionId: number) {
      const result = await apiClient.GET('/api/sessions/{session_id}/metrics', {
        params: {
          path: {
            session_id: sessionId,
          },
        },
      })
      return ensureData(result, 'Unable to load session metrics')
    },
    messages: {
      async list(sessionId: number, params?: { limit?: number; offset?: number }) {
        const result = await apiClient.GET('/api/sessions/{session_id}/messages', {
          params: {
            path: {
              session_id: sessionId,
            },
            query: {
              limit: params?.limit,
              offset: params?.offset,
            },
          },
        })
        return ensureData(result, 'Unable to load messages')
      },
      async delete(sessionId: number, messageId: number) {
        const result = await apiClient.DELETE('/api/sessions/{session_id}/messages/{message_id}', {
          params: {
            path: {
              session_id: sessionId,
              message_id: messageId,
            },
          },
        })
        if (result.error) {
          throw new ApiError(parseErrorMessage(result.error, 'Unable to delete message'), result.response?.status)
        }
      },
      async togglePin(sessionId: number, messageId: number, payload: MessagePinRequest) {
        const result = await apiClient.POST('/api/sessions/{session_id}/messages/{message_id}/pin', {
          params: {
            path: {
              session_id: sessionId,
              message_id: messageId,
            },
          },
          body: payload,
        })
        return ensureData(result, 'Unable to update pin state')
      },
      async requestRegeneration(sessionId: number, messageId: number) {
        const result = await apiClient.POST('/api/sessions/{session_id}/messages/{message_id}/regenerate', {
          params: {
            path: {
              session_id: sessionId,
              message_id: messageId,
            },
          },
        })
        return ensureData(result, 'Unable to prepare regeneration')
      },
    },
  },
  chat: {
    async stream(payload: ChatRequest, onEvent: (event: ChatStreamEvent) => void, signal?: AbortSignal) {
      await streamSSE<ChatStreamEvent>('/api/chat', payload, onEvent, signal)
    },
  },
  models: {
    async list() {
      const result = await apiClient.GET('/api/models')
      return ensureData(result, 'Unable to load models')
    },
    async show(name: string) {
      const result = await apiClient.GET('/api/models/{name}', {
        params: {
          path: {
            name,
          },
        },
      })
      return ensureData(result, 'Unable to load model details')
    },
    async delete(name: string) {
      const result = await apiClient.DELETE('/api/models/{name}', {
        params: {
          path: {
            name,
          },
        },
      })
      return ensureData(result, 'Unable to delete model')
    },
    async load(payload: ModelNameRequest) {
      const result = await apiClient.POST('/api/models/load', { body: payload })
      return ensureData(result, 'Unable to load model into memory')
    },
    async unload(payload: ModelNameRequest) {
      const result = await apiClient.POST('/api/models/unload', { body: payload })
      return ensureData(result, 'Unable to unload model')
    },
    async pull(payload: ModelPullRequest, onEvent: (event: Record<string, unknown>) => void, signal?: AbortSignal) {
      await streamSSE<Record<string, unknown>>('/api/models/pull', payload, onEvent, signal)
    },
  },
}
