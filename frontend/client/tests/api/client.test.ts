import { delay, HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  EmailUnverifiedError,
  MaintenanceError,
  StoppedRequestError,
  UnauthorizedError,
} from '../../src/api/ApiError'
import { apiUrl, client, configureApiClient } from '../../src/api/client'
import { removeXsrfCookie, setXsrfCookie } from '../support/cookies'
import { CSRF_TOKEN_FROM_API, STALE_TOKEN_BODY, staleTokenTwiceThen } from '../support/handlers/authApi'
import { sentRequests, server } from '../support/server'

// src/api/client.ts：送り先・Cookie・CSRF のトークンと、401・419・503・確認していない 403・止めたとき・JSON でない応答の扱い（D-027・D-029）。
// パス（/api/me/likes など）は、送り方を確かめるための例。どの API でも同じに動く

// テストで使う値
// 前にもらってある CSRF のトークン（Cookie の XSRF-TOKEN。API がもらい直させると CSRF_TOKEN_FROM_API になる）
const SAVED_TOKEN = 'xsrf-1'
const MAINTENANCE_BODY = { message: 'ただいまメンテナンス中です' }
const SERVER_ERROR_BODY = { message: 'Server Error' }

// 401・419・503 のときに client.ts が呼ぶ処理（ふだんは app/configureApi.ts が渡す）
const onUnauthorized = vi.fn<(code: string | null) => void>()
const onMaintenance = vi.fn<() => void>()

// 偽物が受けた X-XSRF-TOKEN（送らなければ null）
const xsrfHeaderOf = (request: Request | undefined): string | null => {
  return request?.headers.get('X-XSRF-TOKEN') ?? null
}

// 投げたものを受け取る（投げなければ、テストを誤りにする）
const failureOf = async (request: Promise<unknown>): Promise<unknown> => {
  return request.then(
    () => {
      throw new Error('投げるはずが、通りました')
    },
    (e: unknown) => e,
  )
}

// 応答を返さない偽物（止めたとき・時間切れのため）
const neverAnswer = async (): Promise<Response> => {
  await delay('infinite')
  return HttpResponse.json({})
}

beforeEach(() => {
  onUnauthorized.mockReset()
  onMaintenance.mockReset()
  configureApiClient({ onUnauthorized, onMaintenance })
})

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員の画面が、ログインしたあとの API を読む（GET）', () => {
  it('送り先に、セッションの Cookie を付けて送り、Accept に JSON を付ける。トークンは付けない（D-027）', async () => {
    server.use(http.get(apiUrl('/api/me/likes'), () => HttpResponse.json([])))

    await client.get('/api/me/likes')

    const [sent] = sentRequests('GET', '/api/me/likes')
    expect(sent?.url).toBe('http://localhost:8000/api/me/likes')
    expect(sent?.credentials).toBe('include')
    expect(sent?.headers.get('Accept')).toBe('application/json')
    expect(sent?.headers.has('Authorization')).toBe(false)
  })

  it('読むだけなので、CSRF のトークンを付けない', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(http.get(apiUrl('/api/me/likes'), () => HttpResponse.json([])))

    await client.get('/api/me/likes')

    expect(xsrfHeaderOf(sentRequests('GET', '/api/me/likes')[0])).toBeNull()
  })
})

describe('ログインした会員の画面が、CSRF のトークンの Cookie を持って書き込む', () => {
  it('Cookie の CSRF のトークンを X-XSRF-TOKEN で付け、渡した本文をそのまま送る（FR-AUTH-018）', async () => {
    setXsrfCookie('xsrf token/2')
    server.use(http.post(apiUrl('/api/me/likes'), () => HttpResponse.json({}, { status: 201 })))

    await client.post('/api/me/likes', { to: 'user-b' })

    const [sent] = sentRequests('POST', '/api/me/likes')
    expect(xsrfHeaderOf(sent)).toBe('xsrf token/2')
    expect(await sent?.json()).toEqual({ to: 'user-b' })
  })

  it('204 の空の本文は、失敗にしない', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(http.delete(apiUrl('/api/me/blocks/user-b'), () => new HttpResponse(null, { status: 204 })))

    const res = await client.delete('/api/me/blocks/user-b')

    expect(res.status).toBe(204)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('ログインした会員の画面が、CSRF のトークンの Cookie をまだ持たずに書き込む', () => {
  it('先に GET /sanctum/csrf-cookie を1回呼び、もらったトークンを付けて書き込む', async () => {
    removeXsrfCookie()
    server.use(http.post(apiUrl('/api/me/likes'), () => HttpResponse.json({}, { status: 201 })))

    await client.post('/api/me/likes', {})

    const csrf = sentRequests('GET', '/sanctum/csrf-cookie')
    expect(csrf).toHaveLength(1)
    expect(csrf[0]?.credentials).toBe('include')
    expect(xsrfHeaderOf(sentRequests('POST', '/api/me/likes')[0])).toBe(CSRF_TOKEN_FROM_API)
  })
})

// 正常系とした：古いトークンの書き込みは 419 で断られるが、要件は、もらい直して送り直す操作を通す
describe('メンテナンスのあとに、ログインした会員の画面が古い CSRF のトークンで書き込む（1回目だけ 419）', () => {
  it('トークンをもらい直して、新しいトークンで1回だけ送り直し、通れば成功にする', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.post(apiUrl('/api/me/likes'), ({ request }) =>
        xsrfHeaderOf(request) === CSRF_TOKEN_FROM_API
          ? HttpResponse.json({}, { status: 201 })
          : HttpResponse.json(STALE_TOKEN_BODY, { status: 419 }),
      ),
    )

    const res = await client.post('/api/me/likes', { to: 'user-b' })

    expect(res.status).toBe(201)
    const posts = sentRequests('POST', '/api/me/likes')
    expect(posts.map(xsrfHeaderOf)).toEqual([SAVED_TOKEN, CSRF_TOKEN_FROM_API])
    expect(await posts[1]?.json()).toEqual({ to: 'user-b' })
    expect(sentRequests('GET', '/sanctum/csrf-cookie')).toHaveLength(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

// 正常系とした：止めるのは呼んだ画面の操作で、API は断っていない
describe('画面が、読み込みの途中で止める合図（AbortSignal）を送る', () => {
  it('abort() で止めたら、AbortError を投げる（hook が「止めたので黙る」と見分ける）', async () => {
    server.use(http.get(apiUrl('/api/me/badge-counts'), neverAnswer))
    const controller = new AbortController()

    const request = failureOf(client.get('/api/me/badge-counts', { signal: controller.signal }))
    controller.abort()
    const error = await request

    expect(error).toBeInstanceOf(DOMException)
    expect(error).toHaveProperty('name', 'AbortError')
  })

  it('AbortSignal.timeout() の時間切れなら、AbortError にせず TimeoutError を投げる', async () => {
    server.use(http.get(apiUrl('/api/me'), neverAnswer))

    const error = await failureOf(client.get('/api/me', { signal: AbortSignal.timeout(10) }))

    expect(error).toBeInstanceOf(DOMException)
    expect(error).toHaveProperty('name', 'TimeoutError')
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインが切れた会員の画面が、ログインしたあとの API を読む（401）', () => {
  it('401 の処理に応答の code を渡して1回呼び、続きを止める（UnauthorizedError。FR-UI-100）', async () => {
    server.use(
      http.get(apiUrl('/api/me/likes'), () =>
        HttpResponse.json({ message: 'このアカウントは停止されています', code: 'account_suspended' }, { status: 401 }),
      ),
    )

    const error = await failureOf(client.get('/api/me/likes'))

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(error).toBeInstanceOf(StoppedRequestError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).toHaveBeenCalledWith('account_suspended')
  })

  it('応答に code がなければ、code を null にして 401 の処理を呼ぶ（FR-UI-100）', async () => {
    server.use(
      http.get(apiUrl('/api/me/likes'), () => HttpResponse.json({ message: 'ログインしてください' }, { status: 401 })),
    )

    await expect(client.get('/api/me/likes')).rejects.toThrow(UnauthorizedError)

    expect(onUnauthorized).toHaveBeenCalledWith(null)
  })

  it('本文が JSON でなければ（プロキシの HTML など）、code を null にして 401 の処理を呼ぶ（FR-UI-100）', async () => {
    server.use(
      http.get(
        apiUrl('/api/me/likes'),
        () => new HttpResponse('<html>Unauthorized</html>', { status: 401, headers: { 'Content-Type': 'text/html' } }),
      ),
    )

    await expect(client.get('/api/me/likes')).rejects.toThrow(UnauthorizedError)

    expect(onUnauthorized).toHaveBeenCalledWith(null)
  })
})

describe('メールアドレスを確認していない会員の画面が、確認が要る API を読む（403 の email_unverified）', () => {
  it('続きを止める（EmailUnverifiedError）。401 の処理は呼ばない（FR-AUTH-021）', async () => {
    server.use(
      http.get(apiUrl('/api/me/likes'), () =>
        HttpResponse.json({ message: 'この機能は使えません', code: 'email_unverified' }, { status: 403 }),
      ),
    )

    const error = await failureOf(client.get('/api/me/likes'))

    expect(error).toBeInstanceOf(EmailUnverifiedError)
    expect(error).toBeInstanceOf(StoppedRequestError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('ログインした会員の画面が、ほかの理由で断られる API を読む（403）', () => {
  it('有料が要るなどの 403 は、状態コードと code を持つ ApiError にする（画面が見分ける）', async () => {
    server.use(
      http.get(apiUrl('/api/users'), () =>
        HttpResponse.json({ message: '有料の会員だけが使えます', code: 'paid_required' }, { status: 403 }),
      ),
    )

    const error = await failureOf(client.get('/api/users'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(EmailUnverifiedError)
    expect(error).toMatchObject({ status: 403, code: 'paid_required', serverMessage: '有料の会員だけが使えます' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('本文のない 403 は、確認していない会員とは見なさず、code のない ApiError にする', async () => {
    server.use(http.get(apiUrl('/api/users'), () => new HttpResponse(null, { status: 403 })))

    const error = await failureOf(client.get('/api/users'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
    expect(error).toMatchObject({ status: 403, code: null })
  })
})

describe('ログインした会員の画面が、決まりに合わない値を書き込む（422）', () => {
  it('入力の誤り（errors）を持つ ApiError にする', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.put(apiUrl('/api/me/password'), () =>
        HttpResponse.json(
          { message: '入力に誤りがあります', errors: { password: ['新しいパスワードは8文字以上にしてください'] } },
          { status: 422 },
        ),
      ),
    )

    const error = await failureOf(client.put('/api/me/password', {}))

    expect(error).toBeInstanceOf(ApiError)
    expect(error instanceof ApiError && error.fieldError('password')).toBe('新しいパスワードは8文字以上にしてください')
  })
})

describe('ログインした会員の画面が API を読み、API がサーバーのエラーを返す（500）', () => {
  it('メンテナンスとは見なさず、ApiError にする。401 の処理も呼ばない', async () => {
    server.use(http.get(apiUrl('/api/me/likes'), () => HttpResponse.json(SERVER_ERROR_BODY, { status: 500 })))

    const error = await failureOf(client.get('/api/me/likes'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500 })
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('メンテナンス中に、ログインした会員の画面がログインしたあとの API を読む（503）', () => {
  it('メンテナンスの処理を1回呼び、続きを止める（MaintenanceError。FR-MAINT-006）', async () => {
    server.use(http.get(apiUrl('/api/me/likes'), () => HttpResponse.json(MAINTENANCE_BODY, { status: 503 })))

    const error = await failureOf(client.get('/api/me/likes'))

    expect(error).toBeInstanceOf(MaintenanceError)
    expect(error).toBeInstanceOf(StoppedRequestError)
    expect(onMaintenance).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('API につながらないときに、画面が API を読む', () => {
  it('ApiError にせず、そのまま投げる（呼んだ所が「つながらない」として扱う）', async () => {
    server.use(http.get(apiUrl('/api/me/likes'), () => HttpResponse.error()))

    const error = await failureOf(client.get('/api/me/likes'))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('送り先の設定違いで、画面が API を読むと 2xx の JSON でない本文が返る（画面の index.html など）', () => {
  it('成功にせず、ApiError でもない失敗として投げる（起動の GET /api/me なら「読み込めませんでした」になる）', async () => {
    server.use(
      http.get(
        apiUrl('/api/me/likes'),
        () => new HttpResponse('<!doctype html><title>matching</title>', { headers: { 'Content-Type': 'text/html' } }),
      ),
    )

    const error = await failureOf(client.get('/api/me/likes'))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
  })
})

describe('24時間でログインが切れた会員の画面が、書き込む（送り直しても 419）', () => {
  it('それ以上は送らず、csrf の印で 401 の処理を1回だけ呼び、続きを止める（UnauthorizedError）', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.post(
        apiUrl('/api/me/likes'),
        staleTokenTwiceThen(() => HttpResponse.json({}, { status: 201 })),
      ),
    )

    const error = await failureOf(client.post('/api/me/likes', {}))

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(sentRequests('POST', '/api/me/likes')).toHaveLength(2)
    expect(sentRequests('GET', '/sanctum/csrf-cookie')).toHaveLength(1)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(onUnauthorized).toHaveBeenCalledWith('csrf')
  })
})

describe('ログインが切れた会員の画面が、読むだけの API を読み、419 が返る', () => {
  it('送り直さず、続きを止める（UnauthorizedError）', async () => {
    server.use(http.get(apiUrl('/api/me/likes'), () => HttpResponse.json(STALE_TOKEN_BODY, { status: 419 })))

    await expect(client.get('/api/me/likes')).rejects.toThrow(UnauthorizedError)

    expect(sentRequests('GET', '/api/me/likes')).toHaveLength(1)
    expect(sentRequests('GET', '/sanctum/csrf-cookie')).toHaveLength(0)
  })
})

describe('画面が古いトークンで書き込み（419）、もらい直し（GET /sanctum/csrf-cookie）がつながらない', () => {
  it('送り直さず、つながらない失敗として投げる。401 の処理は呼ばない', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.post(apiUrl('/api/me/likes'), () => HttpResponse.json(STALE_TOKEN_BODY, { status: 419 })),
      http.get(apiUrl('/sanctum/csrf-cookie'), () => HttpResponse.error()),
    )

    const error = await failureOf(client.post('/api/me/likes', {}))

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
    expect(sentRequests('POST', '/api/me/likes')).toHaveLength(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('画面が CSRF のトークンの Cookie を持たずに書き込み、先にもらいに行く GET /sanctum/csrf-cookie がつながらない', () => {
  it('書き込みは送らず、つながらない失敗として投げる', async () => {
    removeXsrfCookie()
    server.use(
      http.post(apiUrl('/api/me/likes'), () => HttpResponse.json({}, { status: 201 })),
      http.get(apiUrl('/sanctum/csrf-cookie'), () => HttpResponse.error()),
    )

    const error = await failureOf(client.post('/api/me/likes', {}))

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
    expect(sentRequests('POST', '/api/me/likes')).toHaveLength(0)
  })
})

describe('ログインの画面が、違うパスワードでログインの API（access: withoutLogin）を呼ぶ（401）', () => {
  it('ログインの画面へは移さず、文を持つ ApiError にする（パスワードの誤りを画面に出すため。FR-UI-100）', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.post(apiUrl('/api/auth/login'), () =>
        HttpResponse.json({ message: 'メールアドレスかパスワードが違います' }, { status: 401 }),
      ),
    )

    const error = await failureOf(client.post('/api/auth/login', {}, { access: 'withoutLogin' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, serverMessage: 'メールアドレスかパスワードが違います' })
    expect(sentRequests('POST', '/api/auth/login')[0]?.credentials).toBe('include')
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('登録の画面が、ログインが要らない書き込み（access: withoutLogin）を古いトークンで送る（送り直しても 419）', () => {
  it('もらい直して1回だけ送り直し、それでも 419 なら、ログインの画面へは移さず ApiError にする', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.post(
        apiUrl('/api/users'),
        staleTokenTwiceThen(() => HttpResponse.json({}, { status: 201 })),
      ),
    )

    const error = await failureOf(client.post('/api/users', {}, { access: 'withoutLogin' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 419 })
    expect(sentRequests('POST', '/api/users')).toHaveLength(2)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('メールアドレスを確認していない会員の画面が、ログインが要らない API（access: withoutLogin）を読む（403 の email_unverified）', () => {
  it('EmailUnverifiedError にせず、ApiError にする', async () => {
    server.use(
      http.get(apiUrl('/api/me'), () =>
        HttpResponse.json({ message: 'この機能は使えません', code: 'email_unverified' }, { status: 403 }),
      ),
    )

    const error = await failureOf(client.get('/api/me', { access: 'withoutLogin' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
  })
})

describe('ログインの画面がログインの API（access: withoutLogin）を呼び、API がサーバーのエラーを返す（500）', () => {
  it('メンテナンスとは見なさず、ApiError にする', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(http.post(apiUrl('/api/auth/login'), () => HttpResponse.json(SERVER_ERROR_BODY, { status: 500 })))

    const error = await failureOf(client.post('/api/auth/login', {}, { access: 'withoutLogin' }))

    expect(error).toMatchObject({ status: 500 })
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('メンテナンス中に、ログインの画面がログインの API（access: withoutLogin）を呼ぶ（503）', () => {
  it('メンテナンスの処理を1回呼んだうえで、MaintenanceError でなく ApiError（503）を投げる（呼んだ画面が文を出す。FR-MAINT-006）', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(http.post(apiUrl('/api/auth/login'), () => HttpResponse.json(MAINTENANCE_BODY, { status: 503 })))

    const error = await failureOf(client.post('/api/auth/login', {}, { access: 'withoutLogin' }))

    expect(onMaintenance).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
    expect(error).toMatchObject({ status: 503 })
  })
})

describe('もうログインしていない会員の画面が、ログアウトの API（access: logout）を呼ぶ（401）', () => {
  it('セッションの Cookie と CSRF のトークンを付けて送り、ログインの画面へは移さず ApiError にする（自分でしたログアウトとして扱う）', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(
      http.post(apiUrl('/api/auth/logout'), () =>
        HttpResponse.json({ message: 'ログインしてください' }, { status: 401 }),
      ),
    )

    const error = await failureOf(client.post('/api/auth/logout', undefined, { access: 'logout' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
    const [sent] = sentRequests('POST', '/api/auth/logout')
    expect(sent?.credentials).toBe('include')
    expect(xsrfHeaderOf(sent)).toBe(SAVED_TOKEN)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('画面がログアウトの API（access: logout）を呼び、API がサーバーのエラーを返す（500）', () => {
  it('メンテナンスとは見なさず、ApiError にする', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(http.post(apiUrl('/api/auth/logout'), () => HttpResponse.json(SERVER_ERROR_BODY, { status: 500 })))

    const error = await failureOf(client.post('/api/auth/logout', undefined, { access: 'logout' }))

    expect(error).toMatchObject({ status: 500 })
    expect(onMaintenance).not.toHaveBeenCalled()
  })
})

describe('メンテナンス中に、画面がログアウトの API（access: logout）を呼ぶ（503）', () => {
  it('メンテナンスの処理を1回呼んだうえで、ApiError（503）を投げる（FR-MAINT-006）', async () => {
    setXsrfCookie(SAVED_TOKEN)
    server.use(http.post(apiUrl('/api/auth/logout'), () => HttpResponse.json(MAINTENANCE_BODY, { status: 503 })))

    const error = await failureOf(client.post('/api/auth/logout', undefined, { access: 'logout' }))

    expect(onMaintenance).toHaveBeenCalledTimes(1)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(StoppedRequestError)
    expect(error).toMatchObject({ status: 503 })
  })
})
