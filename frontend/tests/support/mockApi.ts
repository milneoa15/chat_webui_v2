import type { Page } from '@playwright/test'

const healthPayload = {
  status: 'ok',
  db_status: 'ok',
  ollama_status: 'ok',
  scheduler_status: 'running',
  cached_model_count: 1,
  model_cache_age_seconds: 1,
  model_stats: null,
  uptime_seconds: 42,
  timestamp: new Date().toISOString(),
  version: '0.1.0',
}

const configPayload = {
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

const sessionPayload = {
  items: [
    {
      id: 1,
      title: 'Demo Session',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
}

const sessionMetricsPayload = {
  session_id: 1,
  total_prompt_tokens: 0,
  total_completion_tokens: 0,
  total_messages: 0,
  messages: [],
}

const modelPayload = {
  items: [
    {
      name: 'llama3',
      digest: 'abc',
      size_mib: 1024,
      pulled: true,
      loaded: true,
      last_modified: new Date().toISOString(),
      status: 'running',
      sessions: [1],
      warnings: [],
    },
  ],
  last_refreshed: new Date().toISOString(),
  stats: {
    cpu_percent: 10,
    gpu_percent: 0,
    memory_percent: 5,
    updated_at: new Date().toISOString(),
  },
}

const emptyMessagesPayload = {
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
}

export async function mockApi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('chatbot.setup.complete', '1')
  })

  await page.route(
    (url) => ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '8000' && url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url())
      const fulfill = async (payload: unknown) => {
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
        })
      }
      if (route.request().method() !== 'GET') {
        await fulfill('{}')
        return
      }
      switch (url.pathname) {
        case '/api/health':
          await fulfill(healthPayload)
          break
        case '/api/config':
          await fulfill(configPayload)
          break
        case '/api/sessions':
          await fulfill(sessionPayload)
          break
        case '/api/sessions/1/messages':
          await fulfill(emptyMessagesPayload)
          break
        case '/api/sessions/1/metrics':
          await fulfill(sessionMetricsPayload)
          break
        case '/api/models':
          await fulfill(modelPayload)
          break
        case '/api/version':
          await fulfill({ version: '0.1.0' })
          break
        default:
          await fulfill('{}')
      }
    },
  )
}
