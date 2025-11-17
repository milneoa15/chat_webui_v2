import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { OfflineBanner } from '@/components/OfflineBanner'
import { FirstRunWizard } from '@/components/FirstRunWizard'
import { api } from '@/api/client'
import { useConfigStore } from '@/stores/config'
import clsx from 'clsx'
import { Boxes, MessageSquare, Settings2 } from 'lucide-react'

export type ProtectedLayoutContext = {
  health?: Awaited<ReturnType<typeof api.health>>
  setHeaderActions: (actions: ReactNode | null) => void
}

const routes = [
  { label: 'Chat', path: '/chat', icon: MessageSquare },
  { label: 'Models', path: '/models', icon: Boxes },
  { label: 'Settings', path: '/settings', icon: Settings2 },
]

export function ProtectedLayout() {
  const theme = useConfigStore((state) => state.theme)
  const loadConfig = useConfigStore((state) => state.loadConfig)
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null)
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const isHealthy = data?.status === 'ok' && !isError

  if (isPending && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--surface-base)] text-[color:var(--text-muted)]">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="size-4 animate-spin rounded-full border-2 border-[color:var(--text-muted)] border-t-transparent" />
          <p className="text-sm font-medium uppercase tracking-[0.3em]">Checking API health...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[color:var(--surface-base)] text-[color:var(--text-primary)]">
      <FirstRunWizard />
      <OfflineBanner visible={!isHealthy} onRetry={() => refetch()} />
      <header className="fixed top-0 left-0 right-0 z-30 flex h-9 items-center border-b border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-1">
        <div className="flex w-full items-center justify-between gap-1">
          <div className="flex items-center gap-1 text-[color:var(--text-muted)]">{headerActions}</div>
          <nav className="flex items-center gap-1">
            {routes.map((route) => {
              const Icon = route.icon
              return (
                <NavLink
                  key={route.path}
                  to={route.path}
                  className={({ isActive }) =>
                    clsx(
                      'flex size-7 items-center justify-center border border-transparent text-[color:var(--text-muted)] transition hover:text-[color:var(--accent-primary)]',
                      isActive && 'border-[color:var(--accent-primary)] text-[color:var(--accent-primary)]',
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only">{route.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex flex-1 min-h-0 flex-col overflow-hidden px-0 pb-0 pt-9 font-mono text-sm sm:px-0">
          {isHealthy ? (
            <Outlet context={{ health: data, setHeaderActions }} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[color:var(--text-muted)]">
              <p className="text-lg text-[color:var(--text-primary)]">Waiting for backend connection…</p>
              <p>Start the FastAPI server on port 8000 and press retry to continue.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
