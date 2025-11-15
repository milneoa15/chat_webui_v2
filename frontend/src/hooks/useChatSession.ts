import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type ChatRequest, type ChatStreamEvent, type MessageRead } from '@/api/client'
import { useSessionsStore } from '@/stores/sessions'

const MESSAGE_LIMIT = 200

export type ChatSendOptions = {
  prompt?: string
  model?: string
  systemPrompt?: string
  overrides?: ChatRequest['options']
  regenerateMessageId?: number
}

export type StreamingState = {
  active: boolean
  content: string
  status?: string
  startedAt?: number
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  metrics?: Record<string, unknown>
}

export function useChatSession(sessionId?: number) {
  const [messages, setMessages] = useState<MessageRead[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string | undefined>()
  const [stream, setStream] = useState<StreamingState>({ active: false, content: '' })
  const [lastCompletion, setLastCompletion] = useState<StreamingState | undefined>()
  const abortController = useRef<AbortController | null>(null)
  const sessions = useSessionsStore((state) => state.sessions)

  const resetStream = useCallback(() => {
    setStream({ active: false, content: '' })
    abortController.current = null
  }, [])

  const loadMessages = useCallback(
    async (targetSessionId?: number) => {
      const resolvedSessionId = targetSessionId ?? sessionId
      if (!resolvedSessionId) {
        setMessages([])
        return
      }
      setStatus('loading')
      setError(undefined)
      try {
        const response = await api.sessions.messages.list(resolvedSessionId, {
          limit: MESSAGE_LIMIT,
          offset: 0,
        })
        const items = response.items ?? []
        setMessages(items)
        setStatus('idle')
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Unable to load messages')
      }
    },
    [sessionId],
  )

  useEffect(() => {
    resetStream()
    setLastCompletion(undefined)
    if (!sessionId) {
      setMessages([])
      return
    }
    void loadMessages(sessionId)
  }, [sessionId, loadMessages, resetStream])

  useEffect(() => {
    return () => {
      abortController.current?.abort()
    }
  }, [])

  const handleStreamEvent = useCallback((event: ChatStreamEvent) => {
    switch (event.type) {
      case 'chunk':
        setStream((prev) => ({
          ...prev,
          active: true,
          content: event.content,
        }))
        break
      case 'status':
        setStream((prev) => ({
          ...prev,
          status: event.message,
        }))
        break
      case 'heartbeat':
        setStream((prev) => ({
          ...prev,
          status: 'Streaming…',
        }))
        break
      case 'error':
        setError(event.message)
        resetStream()
        break
      case 'complete':
        setStream((prev) => ({
          ...prev,
          promptTokens: event.prompt_tokens ?? null,
          completionTokens: event.completion_tokens ?? null,
          totalTokens: event.total_tokens ?? null,
          metrics: event.metrics,
        }))
        setLastCompletion({
          active: false,
          content: '',
          promptTokens: event.prompt_tokens ?? null,
          completionTokens: event.completion_tokens ?? null,
          totalTokens: event.total_tokens ?? null,
          metrics: event.metrics ?? {},
        })
        break
      default:
        break
    }
  }, [resetStream])

  const sendPrompt = useCallback(
    async ({ prompt, model, systemPrompt, overrides, regenerateMessageId }: ChatSendOptions) => {
      if (!sessionId) {
        throw new Error('Select or create a session before chatting')
      }
      if (stream.active) {
        throw new Error('Streaming already in progress')
      }
      if (!prompt && !regenerateMessageId) {
        throw new Error('Prompt is required')
      }
      const controller = new AbortController()
      abortController.current = controller
      setLastCompletion(undefined)
      setError(undefined)
      setStream({
        active: true,
        content: '',
        status: 'Contacting model…',
        startedAt: Date.now(),
      })
      if (prompt && !regenerateMessageId) {
        const optimisticId = -Date.now()
        const optimisticMessage: MessageRead = {
          id: optimisticId,
          session_id: sessionId,
          role: 'user',
          content: prompt,
          model: model ?? undefined,
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
          metrics: {},
          is_pinned: false,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, optimisticMessage])
      }
      const payload: ChatRequest = {
        session_id: sessionId,
        prompt,
        model,
        system_prompt: systemPrompt,
        options: overrides,
        regenerate_message_id: regenerateMessageId,
      }
      try {
        await api.chat.stream(payload, handleStreamEvent, controller.signal)
        await loadMessages(sessionId)
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') {
          return
        }
        setError(err instanceof Error ? err.message : 'Chat stream failed')
      } finally {
        resetStream()
      }
    },
    [sessionId, stream.active, handleStreamEvent, loadMessages, resetStream],
  )

  const cancelStream = useCallback(() => {
    abortController.current?.abort()
    resetStream()
  }, [resetStream])

  const deleteMessage = useCallback(
    async (messageId: number) => {
      if (!sessionId) return
      await api.sessions.messages.delete(sessionId, messageId)
      setMessages((prev) => prev.filter((message) => message.id !== messageId))
    },
    [sessionId],
  )

  const togglePin = useCallback(
    async (message: MessageRead) => {
      if (!sessionId) return
      const updated = await api.sessions.messages.togglePin(sessionId, message.id, {
        pinned: !message.is_pinned,
      })
      setMessages((prev) => prev.map((item) => (item.id === message.id ? updated : item)))
    },
    [sessionId],
  )

  const regenerate = useCallback(
    async (messageId: number) => {
      await sendPrompt({ regenerateMessageId: messageId })
    },
    [sendPrompt],
  )

  const session = useMemo(() => sessions.find((item) => item.id === sessionId), [sessions, sessionId])

  return {
    messages,
    status,
    error,
    stream,
    lastCompletion,
    loadMessages,
    sendPrompt,
    cancelStream,
    deleteMessage,
    togglePin,
    regenerate,
    session,
  }
}
