import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureApiClient } from '../api/client'
import { SessionProvider, useSession } from './SessionProvider'

// shared/session/SessionProvider.tsx：起動のときに GET /api/me を読み、ログインしているかを決める（architecture-frontend.md の4章・5章）

const fetchMock = vi.fn<typeof fetch>()
const onUnauthorized = vi.fn<(code: string | null) => void>()

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
  return <p>{s.status === 'signedIn' ? `signedIn:${s.account.userId}:${s.account.emailVerified}` : s.status}</p>
}

function renderSession() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  fetchMock.mockReset()
  onUnauthorized.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  configureApiClient({ readToken: () => sessionStorage.getItem('token'), onUnauthorized })
})

describe('トークンがないまま、アプリを開く', () => {
  it('API を呼ばずに、ログインしていない状態になる', () => {
    renderSession()

    expect(screen.getByText('signedOut')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('トークンがあるまま、アプリを開く', () => {
  beforeEach(() => {
    sessionStorage.setItem('token', 'token-1')
  })

  it('GET /api/me が通れば、ログインしている状態になり、アカウントを画面の形で持つ', async () => {
    fetchMock.mockResolvedValue(meResponse(true))

    renderSession()

    expect(await screen.findByText('signedIn:user-a:true')).toBeInTheDocument()
  })

  it('500 なら、読み込めなかった状態になり、トークンは消さない（FR-UI-013）', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(sessionStorage.getItem('token')).toBe('token-1')
  })

  it('つながらなければ、読み込めなかった状態になり、トークンは消さない', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    renderSession()

    expect(await screen.findByText('error')).toBeInTheDocument()
    expect(sessionStorage.getItem('token')).toBe('token-1')
  })

  it('401 なら、401 の処理（ログインの画面へ移す）に任せ、ここでは状態を変えない', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'ログインしてください' }), { status: 401 }))

    renderSession()

    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledWith(null))
    expect(screen.getByText('loading')).toBeInTheDocument()
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

  it('起動の読み込みの途中でログインし直したら、古い読み込みの結果は捨てる', async () => {
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
      session.signIn('token-2')
    })
    await screen.findByText('signedIn:user-b:true')
    await act(async () => resolveFirst(meResponse(true, 'user-a')))

    expect(screen.getByText('signedIn:user-b:true')).toBeInTheDocument()
  })

  it('読み込みの途中でログアウトしたら、あとから届いた結果は捨てる', async () => {
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
    expect(sessionStorage.getItem('token')).toBeNull()
  })
})

describe('メールアドレスを確認していない会員が、アプリを開く', () => {
  it('ログインしている状態になり、確認していないことを持つ（FR-AUTH-021）', async () => {
    sessionStorage.setItem('token', 'token-1')
    fetchMock.mockResolvedValue(meResponse(false))

    renderSession()

    expect(await screen.findByText('signedIn:user-a:false')).toBeInTheDocument()
  })
})
