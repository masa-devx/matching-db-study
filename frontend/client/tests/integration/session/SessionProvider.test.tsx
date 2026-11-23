import { act, render, screen } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureApiClient } from '../../../src/api/client'
import { SessionProvider, useSession } from '../../../src/shared/session/SessionProvider'
import { accountBody, ME_URL } from '../../support/handlers/profileApi'
import { sentRequests, server } from '../../support/server'

// shared/session/SessionProvider.tsx：起動のときに GET /api/me を読み、ログインしているかを決める（D-027。画面はトークンを持たない）。
// API は MSW で偽物にする（GET /api/me の既定は、メールアドレスを確認した会員 user-a）

// テストで使う値
const SEARCH_CONDITIONS = '{"prefecture":"東京都"}'
const SIGNED_OUT_BODY = { message: 'ログインしてください' }

const onUnauthorized = vi.fn<(code: string | null) => void>()
const onMaintenance = vi.fn<() => void>()
const onAccountChanged = vi.fn<() => void>()

const me = (verified: boolean, publicId = 'user-a') => HttpResponse.json(accountBody({ publicId, verified }))

const unauthorized = (body: Record<string, string>) => HttpResponse.json(body, { status: 401 })

// 1回目の GET /api/me だけ、別の応答にする（2回目からは、あとに書いた応答）
const firstMeThen = (first: () => Response | Promise<Response>, rest: () => Response | Promise<Response>): void => {
  server.use(http.get(ME_URL, first, { once: true }), http.get(ME_URL, rest))
}

// 呼ぶまで応答を返さない GET /api/me（読み込みの途中で、ほかのことをするため）
const heldMe = (): { respond: (res: Response) => void; resolver: () => Promise<Response> } => {
  let respond: (res: Response) => void = () => {}
  const response = new Promise<Response>((done) => {
    respond = done
  })
  return { respond, resolver: () => response }
}

// 状態を文字で出すだけの部品。テストから signIn・signOut・retry を押せるようにする
let session: ReturnType<typeof useSession>
const Probe = () => {
  session = useSession()
  const s = session.session
  return (
    <>
      <p>{s.status === 'signedIn' ? `signedIn:${s.account.userId}:${s.account.emailVerified}` : s.status}</p>
      {s.status === 'signedOut' && <p>理由：{s.reason ?? 'なし'}</p>}
    </>
  )
}

const renderSession = () => {
  return render(
    <SessionProvider onAccountChanged={onAccountChanged}>
      <Probe />
    </SessionProvider>,
  )
}

const showTabAgain = async (): Promise<void> => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  sessionStorage.clear()
  onUnauthorized.mockReset()
  onMaintenance.mockReset()
  onAccountChanged.mockReset()
  configureApiClient({ onUnauthorized, onMaintenance })
})

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、アプリを開く', () => {
  it('セッションの Cookie を付けて GET /api/me を読み、200 ならログインしている状態になる（FR-AUTH-017）', async () => {
    renderSession()

    expect(await screen.findByText('signedIn:user-a:true')).toBeInTheDocument()
    const [sent] = sentRequests('GET', '/api/me')
    expect(sent?.url).toBe('http://localhost:8000/api/me')
    expect(sent?.credentials).toBe('include')
  })
})

describe('メールアドレスを確認していない会員が、アプリを開く', () => {
  it('ログインしている状態になり、確認していないことを持つ（FR-AUTH-021）', async () => {
    server.use(http.get(ME_URL, () => me(false)))

    renderSession()

    expect(await screen.findByText('signedIn:user-a:false')).toBeInTheDocument()
  })
})

describe('会員が、起動の読み込みの途中で、ログインやログアウトをする', () => {
  it('ログインし直したら、古い読み込みの結果は捨てる', async () => {
    const first = heldMe()
    firstMeThen(first.resolver, () => me(true, 'user-b'))
    renderSession()
    await vi.waitFor(() => expect(sentRequests('GET', '/api/me')).toHaveLength(1))

    await act(async () => {
      session.signIn()
    })
    await screen.findByText('signedIn:user-b:true')
    await act(async () => {
      first.respond(me(true, 'user-a'))
    })

    expect(screen.getByText('signedIn:user-b:true')).toBeInTheDocument()
  })

  it('ログアウトしたら、あとから届いた結果は捨て、前の検索の条件も消す', async () => {
    sessionStorage.setItem('searchConditions', SEARCH_CONDITIONS)
    const first = heldMe()
    server.use(http.get(ME_URL, first.resolver))
    renderSession()
    await vi.waitFor(() => expect(sentRequests('GET', '/api/me')).toHaveLength(1))

    await act(async () => {
      session.signOut()
    })
    await act(async () => {
      first.respond(me(true))
    })

    expect(screen.getByText('signedOut')).toBeInTheDocument()
    expect(sessionStorage.getItem('searchConditions')).toBeNull()
  })
})

describe('ログインの画面が、ログインの API が通ったあとに signIn() を呼ぶ', () => {
  it('GET /api/me が通れば、true を返す', async () => {
    firstMeThen(
      () => unauthorized(SIGNED_OUT_BODY),
      () => me(true),
    )
    renderSession()
    await screen.findByText('signedOut')

    let result = false
    await act(async () => {
      result = await session.signIn()
    })

    expect(result).toBe(true)
  })
})

describe('ログインした会員が、ほかのタブから戻ってくる', () => {
  it('ほかのタブで別の会員がログインしていたら、画面を読み込み直す（前の会員として書き込まないように）', async () => {
    firstMeThen(
      () => me(true, 'user-a'),
      () => me(true, 'user-b'),
    )
    renderSession()
    await screen.findByText('signedIn:user-a:true')

    await showTabAgain()

    await vi.waitFor(() => expect(onAccountChanged).toHaveBeenCalledTimes(1))
  })

  it('同じ会員のままなら、何もしない', async () => {
    renderSession()
    await screen.findByText('signedIn:user-a:true')

    await showTabAgain()

    await vi.waitFor(() => expect(sentRequests('GET', '/api/me')).toHaveLength(2))
    await act(async () => {}) // 読み直しの結果を受け取るところまで進める
    expect(onAccountChanged).not.toHaveBeenCalled()
    expect(screen.getByText('signedIn:user-a:true')).toBeInTheDocument()
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、アプリを開く（401）', () => {
  it('ログインしていない状態になる。ここではログインの画面へ移さない（ログインの画面・登録の画面も、この下にあるため）', async () => {
    server.use(http.get(ME_URL, () => unauthorized(SIGNED_OUT_BODY)))

    renderSession()

    expect(await screen.findByText('signedOut')).toBeInTheDocument()
    expect(screen.getByText('理由：なし')).toBeInTheDocument()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('前の会員の画面の情報（前の検索の条件・前の JWT）を消す（FR-UI-100）', async () => {
    sessionStorage.setItem('searchConditions', SEARCH_CONDITIONS)
    sessionStorage.setItem('token', 'old-jwt')
    server.use(http.get(ME_URL, () => unauthorized(SIGNED_OUT_BODY)))

    renderSession()

    await screen.findByText('signedOut')
    expect(sessionStorage.getItem('searchConditions')).toBeNull()
    expect(sessionStorage.getItem('token')).toBeNull()
  })

  it('アカウント停止（account_suspended）なら、その理由を持つ（ログインの画面に出す。NFR-AUTH-001）', async () => {
    server.use(
      http.get(ME_URL, () => unauthorized({ message: 'このアカウントは停止されています', code: 'account_suspended' })),
    )

    renderSession()

    expect(await screen.findByText('理由：account-suspended')).toBeInTheDocument()
  })
})

describe('会員がアプリを開き、ログインしているかを読めない', () => {
  it('500 なら、読み込めなかった状態になる（FR-UI-013）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json({}, { status: 500 })))

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('つながらなければ、読み込めなかった状態になる（FR-UI-013）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.error()))

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('200 でも本文が JSON でなければ（送り先の設定違いで、画面の index.html が返る）、読み込めなかった状態になる（FR-UI-013）', async () => {
    server.use(
      http.get(
        ME_URL,
        () => new HttpResponse('<!doctype html><title>matching</title>', { headers: { 'Content-Type': 'text/html' } }),
      ),
    )

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('10秒たっても応答がなければ（時間切れ）、読み込めなかった状態になる（FR-UI-013）', async () => {
    // AbortSignal.timeout の代わりに、手で止められる signal を渡す（10秒を待たずに、時間切れを起こす）
    const timer = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timer.signal)
    server.use(
      http.get(ME_URL, async () => {
        await delay('infinite')
        return me(true)
      }),
    )
    renderSession()
    await vi.waitFor(() => expect(sentRequests('GET', '/api/me')).toHaveLength(1))

    await act(async () => {
      timer.abort(new DOMException('時間切れ', 'TimeoutError'))
    })

    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('メンテナンス中（503）なら、メンテナンスの処理を呼ぶ（FR-MAINT-006）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json({ message: 'ただいまメンテナンス中です' }, { status: 503 })))

    renderSession()

    await screen.findByText('error')
    expect(onMaintenance).toHaveBeenCalledTimes(1)
  })

  it('読み込めなかったあと、もう一度（retry）で読み直せる', async () => {
    firstMeThen(
      () => HttpResponse.json({}, { status: 500 }),
      () => me(true),
    )
    renderSession()
    await screen.findByText('error')

    await act(async () => {
      session.retry()
    })

    expect(await screen.findByText('signedIn:user-a:true')).toBeInTheDocument()
  })
})

describe('ログインの画面が signIn() を呼んだが、Cookie が届いていない（GET /api/me が 401）', () => {
  it('false を返す（ログインの画面が文を出す）', async () => {
    server.use(http.get(ME_URL, () => unauthorized(SIGNED_OUT_BODY)))
    renderSession()
    await screen.findByText('signedOut')

    let result = true
    await act(async () => {
      result = await session.signIn()
    })

    expect(result).toBe(false)
  })
})

describe('ログインした会員が、ほかのタブでログアウトしてから戻ってくる（401）', () => {
  it('ログインしていない状態になる', async () => {
    firstMeThen(
      () => me(true, 'user-a'),
      () => unauthorized(SIGNED_OUT_BODY),
    )
    renderSession()
    await screen.findByText('signedIn:user-a:true')

    await showTabAgain()

    expect(await screen.findByText('signedOut')).toBeInTheDocument()
  })
})
