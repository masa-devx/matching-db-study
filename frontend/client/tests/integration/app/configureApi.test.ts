import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { setXsrfCookie } from '../../support/cookies'
import { staleTokenTwiceThen } from '../../support/handlers/authApi'
import { server } from '../../support/server'

// app/configureApi.ts：ログインしたあとの API の 401・419 で、ログインした自分の情報を消し、理由を付けてログインの画面へ移す（FR-UI-100）。
// 503 のときはメンテナンス中にし、移さない（FR-MAINT-006）。API は MSW で偽物にし、src/api/client.ts を通す

// テストで使う値
// テストの送り先（vite.config.ts の test.env と同じ。src/api/client.ts をテストごとに読み込み直すので、apiUrl は使わない）
const API = 'http://localhost:8000'
const SEARCH_CONDITIONS = '{"prefecture":"東京都"}'
const SIGNED_OUT_BODY = { message: 'ログインしてください' }
const MAINTENANCE_BODY = { message: 'ただいまメンテナンス中です' }

// configureApi.ts は「もう移している」の印を、maintenance.ts はメンテナンス中かを、ファイルの中に持つので、テストごとに読み込み直す
const setUp = async () => {
  vi.resetModules()
  const { configureApi } = await import('../../../src/app/configureApi')
  const { client } = await import('../../../src/api/client')
  const { MaintenanceError, UnauthorizedError } = await import('../../../src/api/ApiError')
  const maintenance = await import('../../../src/app/maintenance')
  const moveTo = vi.fn<(url: string) => void>()
  configureApi(moveTo)
  return { client, UnauthorizedError, MaintenanceError, maintenance, moveTo }
}

// 前の検索の条件を、画面に覚えさせておく（ログインが切れたら消すもの）
const rememberSearchConditions = (): void => {
  sessionStorage.clear()
  sessionStorage.setItem('searchConditions', SEARCH_CONDITIONS)
}

/**
 * 異常系：要件が断る操作
 */
describe('ログインが切れた会員の画面が、ログインしたあとの API を読む（401）', () => {
  it('前の検索の条件を消し、「ログインが切れました」の理由でログインの画面へ移る（FR-UI-100）', async () => {
    rememberSearchConditions()
    const { client, UnauthorizedError, moveTo } = await setUp()
    server.use(http.get(`${API}/api/me/talk-rooms`, () => HttpResponse.json(SIGNED_OUT_BODY, { status: 401 })))

    await expect(client.get('/api/me/talk-rooms')).rejects.toThrow(UnauthorizedError)

    expect(sessionStorage.getItem('searchConditions')).toBeNull()
    expect(moveTo).toHaveBeenCalledWith('/login?reason=signed-out')
  })

  it('アカウント停止（account_suspended）なら、その理由でログインの画面へ移る（FR-UI-100）', async () => {
    const { client, UnauthorizedError, moveTo } = await setUp()
    server.use(
      http.get(`${API}/api/me/talk-rooms`, () =>
        HttpResponse.json({ message: 'このアカウントは停止されています', code: 'account_suspended' }, { status: 401 }),
      ),
    )

    await expect(client.get('/api/me/talk-rooms')).rejects.toThrow(UnauthorizedError)

    expect(moveTo).toHaveBeenCalledWith('/login?reason=account-suspended')
  })

  it('何本の API が同時に 401 を返しても、移るのは1回（FR-UI-100）', async () => {
    const { client, moveTo } = await setUp()
    server.use(
      http.get(`${API}/api/me/talk-rooms`, () => HttpResponse.json(SIGNED_OUT_BODY, { status: 401 })),
      http.get(`${API}/api/me/received-likes`, () => HttpResponse.json(SIGNED_OUT_BODY, { status: 401 })),
      http.get(`${API}/api/me/badge-counts`, () => HttpResponse.json(SIGNED_OUT_BODY, { status: 401 })),
    )

    const results = await Promise.allSettled([
      client.get('/api/me/talk-rooms'),
      client.get('/api/me/received-likes'),
      client.get('/api/me/badge-counts'),
    ])

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected'])
    expect(moveTo).toHaveBeenCalledTimes(1)
  })
})

describe('メンテナンス中に、会員の画面がログインしたあとの API を読む（503）', () => {
  it('前の検索の条件を消さず、ログインの画面にも移さず、メンテナンス中にする（FR-MAINT-006）', async () => {
    rememberSearchConditions()
    const { client, MaintenanceError, maintenance, moveTo } = await setUp()
    server.use(http.get(`${API}/api/me/talk-rooms`, () => HttpResponse.json(MAINTENANCE_BODY, { status: 503 })))

    await expect(client.get('/api/me/talk-rooms')).rejects.toThrow(MaintenanceError)

    expect(maintenance.isUnderMaintenance()).toBe(true)
    expect(sessionStorage.getItem('searchConditions')).toBe(SEARCH_CONDITIONS)
    expect(moveTo).not.toHaveBeenCalled()
  })
})

describe('メンテナンスに入ったあとに、会員の画面が前に送った要求の 401 を受ける', () => {
  it('前の検索の条件を消さず、ログインの画面にも移さない（FR-MAINT-006）', async () => {
    rememberSearchConditions()
    const { client, MaintenanceError, UnauthorizedError, moveTo } = await setUp()
    // 先に送った要求の応答（401）を、503 を受けたあとまで止めておく
    let release: () => void = () => {}
    const released = new Promise<void>((done) => {
      release = done
    })
    server.use(
      http.get(`${API}/api/me/received-likes`, async () => {
        await released
        return HttpResponse.json(SIGNED_OUT_BODY, { status: 401 })
      }),
      http.get(`${API}/api/me/talk-rooms`, () => HttpResponse.json(MAINTENANCE_BODY, { status: 503 })),
    )
    const sentBefore = client.get('/api/me/received-likes')

    await expect(client.get('/api/me/talk-rooms')).rejects.toThrow(MaintenanceError)
    release()
    await expect(sentBefore).rejects.toThrow(UnauthorizedError)

    expect(sessionStorage.getItem('searchConditions')).toBe(SEARCH_CONDITIONS)
    expect(moveTo).not.toHaveBeenCalled()
  })
})

describe('24時間でログインが切れた会員の画面が、書き込む（419。CSRF のトークンが合わない）', () => {
  it('「ログインが切れました」の理由で、ログインの画面へ1回だけ移る', async () => {
    const { client, UnauthorizedError, moveTo } = await setUp()
    setXsrfCookie('xsrf-1')
    server.use(
      http.post(
        `${API}/api/me/likes`,
        staleTokenTwiceThen(() => HttpResponse.json({}, { status: 201 })),
      ),
    )

    await expect(client.post('/api/me/likes', {})).rejects.toThrow(UnauthorizedError)

    expect(moveTo).toHaveBeenCalledTimes(1)
    expect(moveTo).toHaveBeenCalledWith('/login?reason=signed-out')
  })
})
