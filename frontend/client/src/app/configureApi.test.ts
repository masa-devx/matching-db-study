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
  sessionStorage.setItem('token', 'token-1')
  sessionStorage.setItem('searchConditions', '{"prefecture":"東京都"}')
})

describe('ログインしたあとの API が 401 を返す', () => {
  it('トークンと前の検索の条件を消し、「ログインが切れました」の理由でログインの画面へ移る（FR-UI-100）', async () => {
    const { apiFetch, UnauthorizedError, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(401, { message: 'ログインしてください' })),
    )

    await expect(apiFetch('/api/me')).rejects.toThrow(UnauthorizedError)

    expect(sessionStorage.getItem('token')).toBeNull()
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
  it('トークンを消さず、ログインの画面にも移さず、メンテナンス中にする（FR-MAINT-006）', async () => {
    const { apiFetch, MaintenanceError, moveTo } = await setUp()
    const maintenance = await import('./maintenance')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(503, { message: 'ただいまメンテナンス中です' })),
    )

    await expect(apiFetch('/api/me')).rejects.toThrow(MaintenanceError)

    expect(maintenance.isUnderMaintenance()).toBe(true)
    expect(sessionStorage.getItem('token')).toBe('token-1')
    expect(moveTo).not.toHaveBeenCalled()
  })
})

describe('メンテナンスに入ったあとに、前に送った要求の 401 が届く', () => {
  it('トークンを消さず、ログインの画面にも移さない（FR-MAINT-006）', async () => {
    const { apiFetch, moveTo } = await setUp()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(503, { message: 'ただいまメンテナンス中です' }))
        .mockResolvedValueOnce(jsonResponse(401, { message: 'ログインしてください' })),
    )

    await Promise.allSettled([apiFetch('/api/me'), apiFetch('/api/me/talk-rooms')])

    expect(sessionStorage.getItem('token')).toBe('token-1')
    expect(moveTo).not.toHaveBeenCalled()
  })
})

describe('トークンがない人が、メンテナンス中にアプリを開く', () => {
  it('起動のときに確かめ、メンテナンス中にする（FR-MAINT-006）', async () => {
    sessionStorage.removeItem('token')
    await setUp()
    const maintenance = await import('./maintenance')
    const { checkMaintenanceWithoutLogin } = await import('./checkMaintenance')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(503, { message: 'ただいまメンテナンス中です' }))
    vi.stubGlobal('fetch', fetchMock)

    await checkMaintenanceWithoutLogin()

    expect(maintenance.isUnderMaintenance()).toBe(true)
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false)
  })

  it('メンテナンス中でなければ（401）、いつもの画面のまま', async () => {
    sessionStorage.removeItem('token')
    await setUp()
    const maintenance = await import('./maintenance')
    const { checkMaintenanceWithoutLogin } = await import('./checkMaintenance')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(401, { message: 'ログインしてください' })),
    )

    await checkMaintenanceWithoutLogin()

    expect(maintenance.isUnderMaintenance()).toBe(false)
  })

  it('トークンがあれば、ここでは呼ばない（SessionProvider の GET /api/me で分かる）', async () => {
    await setUp()
    const { checkMaintenanceWithoutLogin } = await import('./checkMaintenance')
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await checkMaintenanceWithoutLogin()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
