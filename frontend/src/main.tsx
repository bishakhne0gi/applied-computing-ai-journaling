import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { initMonitoring } from './utils/monitoring'

// Mocks run in dev (unless VITE_API_MOCKS=off, which talks to `make dev-backend` through the Vite proxy) and in the
// `mock` build the Lighthouse gate audits — never in a real production build.
const mocksEnabled = import.meta.env.MODE === 'mock' || (import.meta.env.DEV && import.meta.env.VITE_API_MOCKS !== 'off')

async function enableMocks(): Promise<void> {
  if (!mocksEnabled) return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

void initMonitoring()

void enableMocks().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
