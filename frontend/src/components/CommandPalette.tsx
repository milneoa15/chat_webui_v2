import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (value: boolean) => void
}

const shortcuts = [
  { label: 'Create session', to: '/chat/new' },
  { label: 'Open model catalog', to: '/models' },
  { label: 'Open settings', to: '/settings' },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()

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
        <Dialog.Content className="fixed left-1/2 top-24 w-[480px] -translate-x-1/2 rounded-xl border border-graphite-700 bg-[#0f0f16] p-3 shadow-2xl">
          <Command>
            <Command.Input placeholder="Search actions" className="w-full bg-transparent p-3 text-lg outline-none" />
            <Command.List className="max-h-72 overflow-auto text-sm">
              {shortcuts.map((shortcut) => (
                <Command.Item
                  key={shortcut.label}
                  value={shortcut.label}
                  onSelect={() => {
                    navigate(shortcut.to)
                    onOpenChange(false)
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-left hover:bg-graphite-800"
                >
                  {shortcut.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
