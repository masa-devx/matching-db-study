import { defineConfig, devices } from '@playwright/test'

// E2E（Playwright。architecture-frontend.md の7章・testing.md の「画面のテスト」）。
// 本物の API と DB で、主な流れを通す。置き場は tests/e2e/。最初は手元で流し、CI には入れない（#290）。
// 前提：リポジトリのルートで docker compose up -d --wait（API は http://localhost:8000・メールの受信箱は http://127.0.0.1:58025）。
// 画面（npm run dev）は、動いていなければ webServer が起こす（動いていれば、それを使う）。
// 書き込む流れ（登録・いいね・マッチ・トーク・有料）は、毎回ちがうメールアドレスで登録した会員を使う（開発用の DB の matching_dev に残る）
export default defineConfig({
  testDir: './tests/e2e',
  // 同じ会員を2つの流れで使わないので、流れどうしは並べて流してよい
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    // localhost にそろえる（127.0.0.1 で開くと、API とは別のサイトになり、セッションの Cookie が届かない。docs/commands.md）
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
