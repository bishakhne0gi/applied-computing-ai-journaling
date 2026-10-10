import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { AppProviders } from './providers/AppProviders'

// Mocks run in dev and in the `mock` build the Lighthouse gate audits — never in a real production build.
async function enableMocks(): Promise<void> {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'mock') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

void enableMocks().then(() => {
  createRoot(root).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  )
})
