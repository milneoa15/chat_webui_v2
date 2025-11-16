import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CommandPalette } from '@/components/CommandPalette'
import { OfflineBanner } from '@/components/OfflineBanner'
import { FirstRunWizard } from '@/components/FirstRunWizard'
import { api } from '@/api/client'
import { useConfigStore } from '@/stores/config'
import clsx from 'clsx'

const routes = [
  { label: 'Chat', path: '/chat' },
  { label: 'Models', path: '/models' },
  { label: 'Settings', path: '/settings' },
]

export function ProtectedLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const theme = useConfigStore((state) => state.theme)
  const loadConfig = useConfigStore((state) => state.loadConfig)
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

  const statusPill = useMemo(
    () =>
      isHealthy
        ? { label: 'Backend online', className: 'bg-emerald-500/20 text-emerald-200' }
        : { label: 'Backend offline', className: 'bg-amber-500/20 text-amber-100' },
    [isHealthy],
  )

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
    <div className="flex min-h-screen flex-col bg-[color:var(--surface-base)] text-[color:var(--text-primary)]">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <FirstRunWizard />
      <OfflineBanner visible={!isHealthy} onRetry={() => refetch()} />
      <header className="flex flex-col gap-4 border-b border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-[color:var(--text-muted)]">Chatbot Web UI v2</p>
          <p className="text-2xl font-semibold text-[color:var(--text-primary)]">Terminal Console</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]">
          <nav className="flex flex-wrap items-center gap-2 font-mono">
            {routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                className={({ isActive }) =>
                  clsx(
                    'rounded-md border px-3 py-1 transition',
                    isActive
                      ? 'border-[color:var(--accent-primary)] text-[color:var(--text-primary)]'
                      : 'border-transparent hover:border-[color:var(--border-strong)]',
                  )
                }
              >
                {route.label}
              </NavLink>
            ))}
          </nav>
          <span className={clsx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px]', statusPill.className)}>
            <span className={clsx('size-2 rounded-full', isHealthy ? 'bg-emerald-300' : 'bg-amber-300 animate-pulse')} />
            {statusPill.label}
          </span>
          <button
            className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-xs font-semibold tracking-[0.35em] text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-panel)]"
            onClick={() => setPaletteOpen(true)}
          >
            ⌘K
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden px-4 py-4 lg:px-8 lg:py-6">
          {isHealthy ? (
            <Outlet context={{ health: data }} />
          ) : (
            <div className="h-full rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] p-8 text-center">
              <p className="text-lg font-semibold">Waiting for backend connection...</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                Start the FastAPI server on port 8000 and press retry to continue.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
