import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { initMonitoring } from './utils/monitoring'

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

void initMonitoring()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
