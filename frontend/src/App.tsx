import { useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { ChatPage } from '@/pages/Chat'
import { ModelsPage } from '@/pages/Models'
import { SettingsPage } from '@/pages/Settings'
import { CommandPalette } from '@/components/CommandPalette'

const navItems = [
  { label: 'Chat', path: '/chat' },
  { label: 'Models', path: '/models' },
  { label: 'Settings', path: '/settings' },
]

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#050509] text-graphite-100">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2 border-b border-graphite-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-graphite-500">Chatbot Web UI v2</p>
            <h1 className="text-3xl font-semibold">Build log</h1>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-full border border-graphite-700 px-4 py-2 text-sm font-medium text-graphite-100 hover:bg-graphite-800"
            onClick={() => setPaletteOpen(true)}
          >
            ⌘K Command Palette
          </button>
        </header>

        <nav className="flex gap-4 text-sm">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `rounded-full border px-4 py-2 ${isActive ? 'border-graphite-200 bg-graphite-800 text-white' : 'border-transparent text-graphite-400 hover:border-graphite-700'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="pb-10">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="*"
              element={
                <div className="rounded-2xl border border-graphite-700 p-8 text-center">
                  <p className="text-lg font-medium">Unknown route.</p>
                  <Link className="mt-4 inline-flex text-sm text-teal-300" to="/chat">
                    Go back to chat
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}
