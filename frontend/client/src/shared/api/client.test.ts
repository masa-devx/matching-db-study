import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  apiFetchForLogout,
  apiFetchWithoutLogin,
  configureApiClient,
  EmailUnverifiedError,
  MaintenanceError,
  StoppedRequestError,
  UnauthorizedError,
} from './client'

// shared/api/client.ts：API を呼ぶ3つの関数。トークンの付け方と、401・403（email_unverified）のときの動き（architecture-frontend.md の4章・7章）

const fetchMock = vi.fn<typeof fetch>()
const onUnauthorized = vi.fn<(code: string | null) => void>()
const onMaintenance = vi.fn<() => void>()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sentHeaders(): Headers {
  const init = fetchMock.mock.calls[0]?.[1]
  return new Headers(init?.headers)
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  onUnauthorized.mockReset()
  onMaintenance.mockReset()
  configureApiClient({ readToken: () => 'token-1', onUnauthorized, onMaintenance })
})

describe('ログインしたあとの API を apiFetch で呼ぶ', () => {
  it('トークンを Authorization に付け、Accept に JSON を付けて送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []))

    await apiFetch('/api/me/likes')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/api/me/likes')
    expect(sentHeaders().get('Authorization')).toBe('Bearer token-1')
    expect(sentHeaders().get('Accept')).toBe('application/json')
  })

  it('トークンがなければ、Authorization を付けない', async () => {
    configureApiClient({ readToken: () => null, onUnauthorized, onMaintenance })
    fetchMock.mockResolvedValue(jsonResponse(200, []))

    await apiFetch('/api/me/likes')

    expect(sentHeaders().has('Authorization')).toBe(false)
  })

  it('トークンが空の文字でも、Authorization を付けない', async () => {
    configureApiClient({ readToken: () => '', onUnauthorized, onMaintenance })
    fetchMock.mockResolvedValue(jsonResponse(200, []))

    await apiFetch('/api/me/likes')

    expect(sentHeaders().has('Authorization')).toBe(false)
  })

  it('呼んだ画面が渡した method・body・signal を、そのまま送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, {}))
    const signal = new AbortController().signal
    const body = JSON.stringify({ to: 'user-b' })

    await apiFetch('/api/me/likes', { method: 'POST', body, signal })

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(body)
    expect(init?.signal).toBe(signal)
  })

  it('401 なら、応答の code を付けて 401 の処理を呼び、続きを止める（UnauthorizedError。FR-UI-100）', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: 'このアカウントは停止されています', code: 'account_suspended' }),
    )

    await expect(apiFetch('/api/me')).rejects.toThrow(UnauthorizedError)
    expect(onUnauthorized).toHaveBeenCalledWith('account_suspended')
  })

  it('401 で code がなければ、code を null にして 401 の処理を呼ぶ（FR-UI-100）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'ログインしてください' }))

    await expect(apiFetch('/api/me')).rejects.toThrow(UnauthorizedError)
    expect(onUnauthorized).toHaveBeenCalledWith(null)
  })

  it('401 の本文が JSON でなければ（プロキシの HTML など）、code を null にして 401 の処理を呼ぶ（FR-UI-100）', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Unauthorized</html>', { status: 401 }))

    await expect(apiFetch('/api/me')).rejects.toThrow(UnauthorizedError)
    expect(onUnauthorized).toHaveBeenCalledWith(null)
  })

  it('本文のない 403 は、確認していない会員とは見なさず、応答をそのまま返す', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))

    const res = await apiFetch('/api/users')

    expect(res.status).toBe(403)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('403 の email_unverified なら、続きを止める（EmailUnverifiedError）。401 の処理は呼ばない（FR-AUTH-021）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { message: 'この機能は使えません', code: 'email_unverified' }))

    const error = await apiFetch('/api/me/likes').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(EmailUnverifiedError)
    expect(error).toBeInstanceOf(StoppedRequestError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('503（メンテナンス中）なら、メンテナンスの処理を呼び、続きを止める（MaintenanceError。FR-MAINT-006）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { message: 'ただいまメンテナンス中です' }))

    const error = await apiFetch('/api/me').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(MaintenanceError)
    expect(error).toBeInstanceOf(StoppedRequestError)
    expect(onMaintenance).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('ほかの 403（有料が要るなど）は、応答をそのまま返す（画面が見分ける）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { message: '有料の会員だけが使えます' }))

    const res = await apiFetch('/api/users')

    expect(res.status).toBe(403)
  })

  it('500 と 204 は、投げずに応答をそのまま返す', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'Server Error' }))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    expect((await apiFetch('/api/me')).status).toBe(500)
    expect((await apiFetch('/api/me/blocks/x', { method: 'DELETE' })).status).toBe(204)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('ログインが要らない API を apiFetchWithoutLogin で呼ぶ', () => {
  it('トークンを付けない。401 でも移らず、応答をそのまま返す（パスワードの誤りを画面に出すため。FR-UI-100）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'メールアドレスかパスワードが違います' }))

    const res = await apiFetchWithoutLogin('/api/auth/login', { method: 'POST' })

    expect(res.status).toBe(401)
    expect(sentHeaders().has('Authorization')).toBe(false)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })

  it('500 は、メンテナンスとは見なさず、応答をそのまま返す', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Server Error' }))

    const res = await apiFetchWithoutLogin('/api/auth/login', { method: 'POST' })

    expect(res.status).toBe(500)
    expect(onMaintenance).not.toHaveBeenCalled()
  })

  it('503（メンテナンス中）なら、メンテナンスの処理を呼び、応答はそのまま返す（待たずに呼ぶ画面があるので投げない。FR-MAINT-006）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { message: 'ただいまメンテナンス中です' }))

    const res = await apiFetchWithoutLogin('/api/auth/login', { method: 'POST' })

    expect(res.status).toBe(503)
    expect(onMaintenance).toHaveBeenCalledTimes(1)
  })
})

describe('ログアウトの API を apiFetchForLogout で呼ぶ', () => {
  it('トークンを付ける。401 でも移らない（自分でしたログアウトとして扱う）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'ログインしてください' }))

    const res = await apiFetchForLogout('/api/auth/logout', { method: 'POST' })

    expect(res.status).toBe(401)
    expect(sentHeaders().get('Authorization')).toBe('Bearer token-1')
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })

  it('500 は、メンテナンスとは見なさず、応答をそのまま返す', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Server Error' }))

    const res = await apiFetchForLogout('/api/auth/logout', { method: 'POST' })

    expect(res.status).toBe(500)
    expect(onMaintenance).not.toHaveBeenCalled()
  })

  it('503（メンテナンス中）なら、メンテナンスの処理を呼び、応答はそのまま返す（FR-MAINT-006）', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { message: 'ただいまメンテナンス中です' }))

    const res = await apiFetchForLogout('/api/auth/logout', { method: 'POST' })

    expect(res.status).toBe(503)
    expect(onMaintenance).toHaveBeenCalledTimes(1)
  })
})
