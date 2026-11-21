import { beforeEach, describe, expect, it, vi } from 'vitest'

// app/configureApi.ts：401 のときに、ログインした自分の情報を消し、理由を付けてログインの画面へ移す（FR-UI-100）

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// configureApi.ts は「もう移している」の印をファイルの中に持つので、テストごとに読み込み直す
async function setUp() {
  vi.resetModules()
  const { configureApi } = await import('./configureApi')
  const client = await import('../shared/api/client')
  const moveTo = vi.fn<(url: string) => void>()
  configureApi(moveTo)
  return { apiFetch: client.apiFetch, moveTo }
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('token', 'token-1')
  sessionStorage.setItem('searchConditions', '{"prefecture":"東京都"}')
})

describe('ログインしたあとの API が 401 を返す', () => {
  it('トークンと前の検索の条件を消し、「ログインが切れました」の理由でログインの画面へ移る', async () => {
    const { apiFetch, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(401, { message: 'ログインしてください' })),
    )

    await apiFetch('/api/me').catch(() => {})

    expect(sessionStorage.getItem('token')).toBeNull()
    expect(sessionStorage.getItem('searchConditions')).toBeNull()
    expect(moveTo).toHaveBeenCalledWith('/login?reason=signed-out')
  })

  it('アカウント停止（account_suspended）なら、その理由でログインの画面へ移る', async () => {
    const { apiFetch, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(401, { message: 'このアカウントは停止されています', code: 'account_suspended' }),
        ),
    )

    await apiFetch('/api/me').catch(() => {})

    expect(moveTo).toHaveBeenCalledWith('/login?reason=account-suspended')
  })

  it('何本の API が同時に 401 を返しても、移るのは1回', async () => {
    const { apiFetch, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(401, { message: 'ログインしてください' })),
    )

    await Promise.allSettled([apiFetch('/api/me'), apiFetch('/api/me/talk-rooms'), apiFetch('/api/me/received-likes')])

    expect(moveTo).toHaveBeenCalledTimes(1)
  })
})
