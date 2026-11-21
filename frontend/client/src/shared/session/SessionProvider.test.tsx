import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureApiClient } from '../api/client'
import { SessionProvider, useSession } from './SessionProvider'

// shared/session/SessionProvider.tsx：起動のときに GET /api/me を読み、ログインしているかを決める（architecture-frontend.md の4章・5章）。
// ログインしているかは、セッションの Cookie で API が決める（D-027）。画面はトークンを持たない

const fetchMock = vi.fn<typeof fetch>()
const onUnauthorized = vi.fn<(code: string | null) => void>()
const onMaintenance = vi.fn<() => void>()

function meResponse(verified: boolean, publicId = 'user-a'): Response {
  const body = {
    public_id: publicId,
    email: `${publicId}@example.test`,
    email_verified_at: verified ? '2026-11-01 00:00:00' : null,
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// 状態を文字で出すだけの部品。テストから signIn・signOut・retry を押せるようにする
let session: ReturnType<typeof useSession>
function Probe() {
  session = useSession()
  const s = session.session
  return (
    <>
      <p>{s.status === 'signedIn' ? `signedIn:${s.account.userId}:${s.account.emailVerified}` : s.status}</p>
      {s.status === 'signedOut' && <p>理由：{s.reason ?? 'なし'}</p>}
    </>
  )
}

const onAccountChanged = vi.fn<() => void>()

function renderSession() {
  return render(
    <SessionProvider onAccountChanged={onAccountChanged}>
      <Probe />
    </SessionProvider>,
  )
}

function unauthorized(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 401, headers: { 'Content-Type': 'application/json' } })
}

async function showTabAgain(): Promise<void> {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  onUnauthorized.mockReset()
  onMaintenance.mockReset()
  onAccountChanged.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  configureApiClient({ onUnauthorized, onMaintenance })
})

describe('アプリを開く', () => {
  it('セッションの Cookie を付けて GET /api/me を読み、200 ならログインしている状態になる（FR-AUTH-017）', async () => {
    fetchMock.mockResolvedValue(meResponse(true))

    renderSession()

    expect(await screen.findByText('signedIn:user-a:true')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8000/api/me')
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include')
  })

  it('401 なら、ログインしていない状態になる。ここではログインの画面へ移さない（ログインの画面・登録の画面も、この下にあるため）', async () => {
    fetchMock.mockResolvedValue(unauthorized({ message: 'ログインしてください' }))

    renderSession()

    expect(await screen.findByText('signedOut')).toBeInTheDocument()
    expect(screen.getByText('理由：なし')).toBeInTheDocument()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('401 なら、前の会員の画面の情報（前の検索の条件・前の JWT）を消す（FR-UI-100）', async () => {
    sessionStorage.setItem('searchConditions', '{"prefecture":"東京都"}')
    sessionStorage.setItem('token', 'old-jwt')
    fetchMock.mockResolvedValue(unauthorized({ message: 'ログインしてください' }))

    renderSession()

    await screen.findByText('signedOut')
    expect(sessionStorage.getItem('searchConditions')).toBeNull()
    expect(sessionStorage.getItem('token')).toBeNull()
  })

  it('アカウント停止（account_suspended）の 401 なら、その理由を持つ（ログインの画面に出す。NFR-AUTH-001）', async () => {
    fetchMock.mockResolvedValue(
      unauthorized({ message: 'このアカウントは停止されています', code: 'account_suspended' }),
    )

    renderSession()

    expect(await screen.findByText('理由：account-suspended')).toBeInTheDocument()
  })

  it('500 なら、読み込めなかった状態になる（FR-UI-013）', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('つながらなければ、読み込めなかった状態になる（FR-UI-013）', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
  })

  it('10秒たっても応答がなければ（時間切れ）、読み込めなかった状態になる（FR-UI-013）', async () => {
    // AbortSignal.timeout の代わりに、手で止められる signal を渡す（10秒を待たずに、時間切れを起こす）
    const timer = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timer.signal)
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    renderSession()

    await act(async () => {
      timer.abort(new DOMException('時間切れ', 'TimeoutError'))
    })

    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('メンテナンス中（503）なら、メンテナンスの処理を呼ぶ（FR-MAINT-006）', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'ただいまメンテナンス中です' }), { status: 503 }),
    )

    renderSession()

    await screen.findByText('error')
    expect(onMaintenance).toHaveBeenCalledTimes(1)
  })

  it('読み込めなかったあと、もう一度（retry）で読み直せる', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    fetchMock.mockResolvedValueOnce(meResponse(true))
    renderSession()
    await screen.findByText('error')

    await act(async () => {
      session.retry()
    })

    expect(await screen.findByText('signedIn:user-a:true')).toBeInTheDocument()
  })
})

describe('起動の読み込みの途中で、ログインやログアウトをする', () => {
  it('ログインし直したら、古い読み込みの結果は捨てる', async () => {
    let resolveFirst: (res: Response) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve
        }),
    )
    fetchMock.mockResolvedValueOnce(meResponse(true, 'user-b'))
    renderSession()

    await act(async () => {
      session.signIn()
    })
    await screen.findByText('signedIn:user-b:true')
    await act(async () => resolveFirst(meResponse(true, 'user-a')))

    expect(screen.getByText('signedIn:user-b:true')).toBeInTheDocument()
  })

  it('ログアウトしたら、あとから届いた結果は捨て、前の検索の条件も消す', async () => {
    sessionStorage.setItem('searchConditions', '{"prefecture":"東京都"}')
    let resolveFirst: (res: Response) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve
        }),
    )
    renderSession()

    await act(async () => {
      session.signOut()
    })
    await act(async () => resolveFirst(meResponse(true)))

    expect(screen.getByText('signedOut')).toBeInTheDocument()
    expect(sessionStorage.getItem('searchConditions')).toBeNull()
  })
})

describe('ログインの画面が、ログインの API のあとに signIn() を呼ぶ', () => {
  it('GET /api/me が通れば true を返す', async () => {
    fetchMock.mockResolvedValueOnce(unauthorized({ message: 'ログインしてください' }))
    fetchMock.mockResolvedValueOnce(meResponse(true))
    renderSession()
    await screen.findByText('signedOut')

    let result = false
    await act(async () => {
      result = await session.signIn()
    })

    expect(result).toBe(true)
  })

  it('Cookie が届かず GET /api/me が 401 なら、false を返す（ログインの画面が文を出す）', async () => {
    fetchMock.mockResolvedValue(unauthorized({ message: 'ログインしてください' }))
    renderSession()
    await screen.findByText('signedOut')

    let result = true
    await act(async () => {
      result = await session.signIn()
    })

    expect(result).toBe(false)
  })
})

describe('ログインした会員が、ほかのタブから戻ってくる', () => {
  it('ほかのタブで別の会員がログインしていたら、画面を読み込み直す（前の会員として書き込まないように）', async () => {
    fetchMock.mockResolvedValueOnce(meResponse(true, 'user-a'))
    fetchMock.mockResolvedValueOnce(meResponse(true, 'user-b'))
    renderSession()
    await screen.findByText('signedIn:user-a:true')

    await showTabAgain()

    expect(onAccountChanged).toHaveBeenCalledTimes(1)
  })

  it('同じ会員のままなら、何もしない', async () => {
    fetchMock.mockResolvedValue(meResponse(true, 'user-a'))
    renderSession()
    await screen.findByText('signedIn:user-a:true')

    await showTabAgain()

    expect(onAccountChanged).not.toHaveBeenCalled()
    expect(screen.getByText('signedIn:user-a:true')).toBeInTheDocument()
  })

  it('ほかのタブでログアウトしていたら（401）、ログインしていない状態になる', async () => {
    fetchMock.mockResolvedValueOnce(meResponse(true, 'user-a'))
    fetchMock.mockResolvedValueOnce(unauthorized({ message: 'ログインしてください' }))
    renderSession()
    await screen.findByText('signedIn:user-a:true')

    await showTabAgain()

    expect(await screen.findByText('signedOut')).toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が、アプリを開く', () => {
  it('ログインしている状態になり、確認していないことを持つ（FR-AUTH-021）', async () => {
    fetchMock.mockResolvedValue(meResponse(false))

    renderSession()

    expect(await screen.findByText('signedIn:user-a:false')).toBeInTheDocument()
  })
})
