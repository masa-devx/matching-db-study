import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLogout } from './useLogout'

// shared/session/useLogout.ts：ログアウトの手順（FR-AUTH-016）。サーバーのセッションが消えたときだけ、画面の自分の情報を消す

const signOut = vi.fn()
const fetchMock = vi.fn<typeof fetch>()

vi.mock('./SessionProvider', () => ({
  useSession: () => ({ signOut }),
}))

function respond(status: number): void {
  fetchMock.mockImplementation(async (url) =>
    String(url).endsWith('/sanctum/csrf-cookie') ? new Response(null, { status: 204 }) : new Response(null, { status }),
  )
}

async function logout(): Promise<boolean> {
  const { result } = renderHook(() => useLogout())
  let done = false
  await act(async () => {
    done = await result.current.logout()
  })
  return done
}

beforeEach(() => {
  signOut.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('ログインした会員が、ログアウトする', () => {
  it('204 なら、画面の自分の情報を消し、true を返す', async () => {
    respond(204)

    expect(await logout()).toBe(true)
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/logout'))).toBe(true)
  })

  it.each([401, 419])('%i（もうセッションがない）でも、ログアウトしたのと同じに扱う', async (status) => {
    respond(status)

    expect(await logout()).toBe(true)
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('500 なら、画面の自分の情報を消さず、false を返す（サーバーのセッションが生きたままなので）', async () => {
    respond(500)

    expect(await logout()).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('つながらないときも、false を返す', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await logout()).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })
})
