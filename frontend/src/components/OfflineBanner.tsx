import { WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'

type OfflineBannerProps = {
  visible: boolean
  message?: ReactNode
  onRetry?: () => void
}

export function OfflineBanner({ visible, message, onRetry }: OfflineBannerProps) {
  if (!visible) {
    return null
  }

  return (
    <div className="sticky top-0 z-30 border-b border-[color:var(--offline-border)] bg-[color:var(--surface-warning)] text-[color:var(--warning-text)]">
      <div className="flex items-center justify-between gap-4 px-6 py-3 text-sm font-medium">
        <div className="flex items-center gap-2">
          <WifiOff className="size-4" />
          <span>{message ?? 'Backend unreachable. Check the FastAPI service and retry.'}</span>
        </div>
        {onRetry && (
          <button
            className="inline-flex items-center rounded-full border border-[color:var(--offline-border)] px-3 py-1 text-xs uppercase tracking-widest transition hover:bg-[color:var(--offline-border)]"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
