import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 12 管理画面の画面。会員の画面（frontend/ の 5173）とは別のアプリで、5174 で開く
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
})
