import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionsStore } from '@/stores/sessions'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (value: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { sessions, createSession, selectSession } = useSessionsStore()

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-24 w-[520px] -translate-x-1/2 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] p-4">
          <Command>
            <Command.Input placeholder="Search actions" className="w-full bg-transparent p-3 text-lg outline-none" />
            <Command.List className="max-h-80 space-y-2 overflow-auto text-sm">
              <Command.Group heading="Actions" className="space-y-1 px-1">
                <Command.Item
                  value="Create session"
                  onSelect={async () => {
                    try {
                      const session = await createSession()
                      selectSession(session.id)
                      navigate(`/chat/${session.id}`)
                      onOpenChange(false)
                    } catch (error) {
                      console.error('Unable to create session', error)
                    }
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-left transition hover:bg-[color:var(--surface-muted)]"
                >
                  Create session
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Navigate" className="space-y-1 px-1">
                <Command.Item
                  value="Go to chat"
                  onSelect={() => {
                    navigate('/chat')
                    onOpenChange(false)
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-left transition hover:bg-[color:var(--surface-muted)]"
                >
                  Go to chat
                </Command.Item>
                <Command.Item
                  value="Open model catalog"
                  onSelect={() => {
                    navigate('/models')
                    onOpenChange(false)
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-left transition hover:bg-[color:var(--surface-muted)]"
                >
                  Open model catalog
                </Command.Item>
                <Command.Item
                  value="Open settings"
                  onSelect={() => {
                    navigate('/settings')
                    onOpenChange(false)
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-left transition hover:bg-[color:var(--surface-muted)]"
                >
                  Open settings
                </Command.Item>
              </Command.Group>

              {sessions.length > 0 && (
                <Command.Group heading="Recent sessions" className="space-y-1 px-1">
                  {sessions.slice(0, 5).map((session) => (
                    <Command.Item
                      key={session.id}
                      value={session.title}
                      onSelect={() => {
                        selectSession(session.id)
                        navigate(`/chat/${session.id}`)
                        onOpenChange(false)
                      }}
                      className="cursor-pointer rounded-lg px-3 py-2 text-left transition hover:bg-[color:var(--surface-muted)]"
                    >
                      {session.title}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
