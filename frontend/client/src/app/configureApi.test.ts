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
  return {
    apiFetch: client.apiFetch,
    UnauthorizedError: client.UnauthorizedError,
    MaintenanceError: client.MaintenanceError,
    moveTo,
  }
}

beforeEach(() => {
  sessionStorage.clear()
  sessionStorage.setItem('searchConditions', '{"prefecture":"東京都"}')
})

describe('ログインしたあとの API が 401 を返す', () => {
  it('前の検索の条件を消し、「ログインが切れました」の理由でログインの画面へ移る（FR-UI-100）', async () => {
    const { apiFetch, UnauthorizedError, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(401, { message: 'ログインしてください' })),
    )

    await expect(apiFetch('/api/me')).rejects.toThrow(UnauthorizedError)

    expect(sessionStorage.getItem('searchConditions')).toBeNull()
    expect(moveTo).toHaveBeenCalledWith('/login?reason=signed-out')
  })

  it('アカウント停止（account_suspended）なら、その理由でログインの画面へ移る（FR-UI-100）', async () => {
    const { apiFetch, UnauthorizedError, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(401, { message: 'このアカウントは停止されています', code: 'account_suspended' }),
        ),
    )

    await expect(apiFetch('/api/me')).rejects.toThrow(UnauthorizedError)

    expect(moveTo).toHaveBeenCalledWith('/login?reason=account-suspended')
  })

  it('何本の API が同時に 401 を返しても、移るのは1回（FR-UI-100）', async () => {
    const { apiFetch, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(401, { message: 'ログインしてください' })),
    )

    await Promise.allSettled([apiFetch('/api/me'), apiFetch('/api/me/talk-rooms'), apiFetch('/api/me/received-likes')])

    expect(moveTo).toHaveBeenCalledTimes(1)
  })
})

describe('ログインしたあとの API が 503（メンテナンス中）を返す', () => {
  it('前の検索の条件を消さず、ログインの画面にも移さず、メンテナンス中にする（FR-MAINT-006）', async () => {
    const { apiFetch, MaintenanceError, moveTo } = await setUp()
    const maintenance = await import('./maintenance')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(503, { message: 'ただいまメンテナンス中です' })),
    )

    await expect(apiFetch('/api/me')).rejects.toThrow(MaintenanceError)

    expect(maintenance.isUnderMaintenance()).toBe(true)
    expect(sessionStorage.getItem('searchConditions')).not.toBeNull()
    expect(moveTo).not.toHaveBeenCalled()
  })
})

describe('メンテナンスに入ったあとに、前に送った要求の 401 が届く', () => {
  it('前の検索の条件を消さず、ログインの画面にも移さない（FR-MAINT-006）', async () => {
    const { apiFetch, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(503, { message: 'ただいまメンテナンス中です' }))
        .mockResolvedValueOnce(jsonResponse(401, { message: 'ログインしてください' })),
    )

    await Promise.allSettled([apiFetch('/api/me'), apiFetch('/api/me/talk-rooms')])

    expect(sessionStorage.getItem('searchConditions')).not.toBeNull()
    expect(moveTo).not.toHaveBeenCalled()
  })
})

describe('ログインしたあとの書き込みが 419（CSRF のトークンが合わない）を返す', () => {
  it('「ログインが切れました」の理由で、ログインの画面へ移る（24時間で切れたあとの書き込みも、ここに来る）', async () => {
    const { apiFetch, UnauthorizedError, moveTo } = await setUp()
    // biome-ignore lint/suspicious/noDocumentCookie: テストで、API が付ける Cookie の代わりに置く（jsdom には Cookie Store API がない）
    document.cookie = 'XSRF-TOKEN=xsrf-1; path=/'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(419, { message: '画面を読み込み直してください' })),
    )

    await expect(apiFetch('/api/me/likes', { method: 'POST', body: '{}' })).rejects.toThrow(UnauthorizedError)

    expect(moveTo).toHaveBeenCalledWith('/login?reason=signed-out')
  })
})
