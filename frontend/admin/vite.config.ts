import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// テストの時刻の帯を日本に決める。CI（UTC）でも、日時の読み替え（時刻の帯の印がない日時）が効いているかを確かめるため
process.env.TZ = 'Asia/Tokyo'

// 12 管理画面の画面。会員の画面（frontend/ の 5173）とは別のアプリで、5174 で開く
// テスト（npm test）も、この設定を使う（#114）。テストは、確かめるファイルの隣に *.test.ts(x) で置く
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // vi.spyOn と vi.stubGlobal（fetch の差し替え）を、テストごとに戻す
    restoreMocks: true,
    unstubGlobals: true,
  },
})
