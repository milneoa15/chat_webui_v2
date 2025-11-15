import { Navigate, Route, Routes } from 'react-router-dom'
import { ChatPage } from '@/pages/Chat'
import { ModelsPage } from '@/pages/Models'
import { SettingsPage } from '@/pages/Settings'
import { ProtectedLayout } from '@/components/ProtectedLayout'

export default function App() {
  return (
    <Routes>
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:sessionId" element={<ChatPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
