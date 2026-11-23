import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// テストの時刻の帯を日本に決める。CI（UTC）でも、日時の読み替え（時刻の帯の印がない日時）が効いているかを確かめるため
process.env.TZ = 'Asia/Tokyo'

// テストの API の送り先。画面のオリジン（jsdom の URL）と同じにする。
// jsdom は、ほかのオリジンへの XMLHttpRequest で CORS を確かめ、CORS の印のない偽の応答（MSW）を止めるため。CORS は、E2E（#299）を入れるまで確かめない
const TEST_ORIGIN = 'http://localhost:8000'

// https://vite.dev/config/
// テスト（npm test）も、この設定を使う（#114）。画面は jsdom の上で描く。テストは tests/ に置く（testing.md の「画面のテスト」）。
// API は MSW で偽物にする（tests/support/server.ts。#290）。E2E は、まだ入れない（#299）
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: TEST_ORIGIN } },
    // 手元の .env.local の送り先に左右されないよう、テストでは送り先を決めておく
    env: { VITE_API_URL: TEST_ORIGIN },
    setupFiles: ['./tests/support/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // vi.spyOn と vi.stubGlobal を、テストごとに戻す
    restoreMocks: true,
    unstubGlobals: true,
  },
})
