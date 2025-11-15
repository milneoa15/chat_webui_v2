import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Theme accentColor="jade" grayColor="slate" radius="large" appearance="dark">
          <App />
        </Theme>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
