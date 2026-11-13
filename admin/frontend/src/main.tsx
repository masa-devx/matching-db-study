import '@mantine/core/styles.css'
import '@mantine/charts/styles.css'
import { MantineProvider } from '@mantine/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'

// 12 管理画面の入口。部品とグラフは Mantine（解説の「選択肢」）
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <MantineProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
