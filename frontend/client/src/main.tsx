import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { configureApi } from './app/configureApi'
import { MaintenanceGate } from './app/MaintenanceGate'
import { SessionProvider } from './shared/session/SessionProvider'

configureApi()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MaintenanceGate>
        <SessionProvider>
          <App />
        </SessionProvider>
      </MaintenanceGate>
    </BrowserRouter>
  </StrictMode>,
)
