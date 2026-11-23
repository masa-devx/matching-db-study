// テストの前に1回読む（vite.config.ts の setupFiles）。
// jest-dom の確かめ方（toBeInTheDocument など）を足し、テストごとに描いた画面を片付ける。
// API の偽物（MSW。tests/support/server.ts）を、テストの間だけ動かす。偽の応答を置いていない API を呼んだら、そのテストを誤りにする
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { removeXsrfCookie } from './cookies'
import { server, takeUnhandled } from './server'

// DOMException を、ブラウザと同じく1種類にそろえる。
// テストの jsdom では、AbortController と AbortSignal.timeout() は Node のもので、止めた理由（AbortError・TimeoutError）は Node の DOMException になる。
// 一方、グローバルの DOMException は jsdom のものなので、本物の止め方では instanceof DOMException が通らない（ブラウザでは同じ1つなので通る）。
// そろえないと、hook の「止めたので黙る」（useBadgeCounts）を、本物の止め方で確かめられない
const abortReason: unknown = (() => {
  const controller = new AbortController()
  controller.abort()
  return controller.signal.reason
})()
if (abortReason instanceof Error && !(abortReason instanceof DOMException)) {
  Object.defineProperty(globalThis, 'DOMException', {
    value: abortReason.constructor,
    configurable: true,
    writable: true,
  })
}

beforeAll(() => {
  // 'error'：偽の応答を置いていない要求は、つながらない失敗にする（本物の API へは送らない）
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  removeXsrfCookie()
  const unhandled = takeUnhandled()
  if (unhandled.length > 0) {
    throw new Error(`呼ぶはずのない API が呼ばれました（偽の応答がない）：${unhandled.join('、')}`)
  }
})

afterAll(() => {
  server.close()
})
