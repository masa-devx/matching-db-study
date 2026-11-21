// テストの前に1回読む（vite.config.ts の setupFiles）。
// jest-dom の確かめ方（toBeInTheDocument など）を足し、テストごとに描いた画面を片付ける
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
