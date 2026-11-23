import { act, renderHook } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiUrl } from '../../../src/api/client'
import { useLogout } from '../../../src/shared/session/useLogout'
import { staleTokenTwiceThen } from '../../support/handlers/authApi'
import { sentRequests, server } from '../../support/server'

// shared/session/useLogout.ts：ログアウトの手順（FR-AUTH-016）。サーバーのセッションが消えたときだけ、画面の自分の情報を消す。
// API は MSW で偽物にする（POST /api/auth/logout の既定は 204）

// テストで使う値
const signOut = vi.fn()

vi.mock('../../../src/shared/session/SessionProvider', () => ({
  useSession: () => ({ signOut }),
}))

// 419 は、送り直しても 419 の形にする（3回目まで送ると 500 になり、テストが落ちる）
const respondToLogout = (status: number): void => {
  const answer = () => new HttpResponse(null, { status })
  const resolver = status === 419 ? staleTokenTwiceThen(() => new HttpResponse(null, { status: 500 })) : answer
  server.use(http.post(apiUrl('/api/auth/logout'), resolver))
}

const logout = async (): Promise<boolean> => {
  const { result } = renderHook(() => useLogout())
  let done = false
  await act(async () => {
    done = await result.current.logout()
  })
  return done
}

beforeEach(() => {
  signOut.mockReset()
})

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、ログアウトする（204）', () => {
  it('ログアウトの API を1回呼び、画面の自分の情報を消して、true を返す', async () => {
    const done = await logout()

    expect(done).toBe(true)
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(sentRequests('POST', '/api/auth/logout')).toHaveLength(1)
  })
})

// 正常系とした：API は 401・419 で断るが、もうセッションがないので、要件はログアウトしたのと同じに扱う
describe('もうセッションがない会員が、ログアウトする（401・419）', () => {
  it.each([401, 419])('%i でも、画面の自分の情報を消して、true を返す', async (status) => {
    respondToLogout(status)

    const done = await logout()

    expect(done).toBe(true)
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員がログアウトし、API がサーバーのエラーを返す（500）', () => {
  it('画面の自分の情報を消さず、false を返す（サーバーのセッションが生きたままなので）', async () => {
    respondToLogout(500)

    const done = await logout()

    expect(done).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })
})

describe('ログインした会員がログアウトし、API につながらない', () => {
  it('画面の自分の情報を消さず、false を返す', async () => {
    server.use(http.post(apiUrl('/api/auth/logout'), () => HttpResponse.error()))

    const done = await logout()

    expect(done).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })
})
