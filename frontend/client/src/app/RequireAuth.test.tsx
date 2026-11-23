import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import type { SessionState } from '../shared/session/SessionProvider'
import { RequireAuth } from './RequireAuth'

// app/RequireAuth.tsx：ログインが要る画面の守り。ログインしていない・確認していない・使える会員の出し分け（FR-UI-011・FR-AUTH-021）

const retry = vi.fn()
const signOut = vi.fn()
const fetchMock = vi.fn<typeof fetch>()
let state: SessionState = { status: 'signedOut' }

vi.mock('../shared/session/SessionProvider', () => ({
  useSession: () => ({ session: state, retry, signIn: vi.fn(), signOut }),
}))

const unverified: SessionState = {
  status: 'signedIn',
  account: { userId: 'u', email: 'u@example.test', emailVerified: false },
}

// ブラウザの「戻る」を押せるログインの画面（履歴を置き換えたかを確かめるため）
const LoginScreen = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  return (
    <>
      <p>ログインの画面</p>
      <p>理由：{params.get('reason') ?? 'なし'}</p>
      <button type="button" onClick={() => navigate(-1)}>
        戻る
      </button>
    </>
  )
}

// 履歴は「はじめの画面 → 開く画面」の2つから始める
const renderAt = (path: string) => {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/start', path]} initialIndex={1}>
        <Routes>
          <Route path="/start" element={<p>はじめの画面</p>} />
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireAuth />}>
            <Route path="/home" element={<p>ホームの画面</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

const jsonResponse = (status: number): Response => {
  return new Response('{}', { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  retry.mockReset()
  signOut.mockReset()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse(200))
  vi.stubGlobal('fetch', fetchMock)
})

describe('ログインしていない人が、ログインが要る画面を開く', () => {
  it('ログインの画面へ移る（FR-UI-011）', () => {
    state = { status: 'signedOut' }

    renderAt('/home')

    expect(screen.getByText('ログインの画面')).toBeInTheDocument()
    expect(screen.queryByText('ホームの画面')).not.toBeInTheDocument()
  })

  it('アカウント停止なら、理由を付けてログインの画面へ移る（FR-UI-100・NFR-AUTH-001）', () => {
    state = { status: 'signedOut', reason: 'account-suspended' }

    renderAt('/home')

    expect(screen.getByText('理由：account-suspended')).toBeInTheDocument()
  })

  it('移るときは履歴を置き換える。ログインの画面で戻ると、その前の画面に戻る（FR-UI-011）', async () => {
    state = { status: 'signedOut' }
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '戻る' }))

    expect(screen.getByText('はじめの画面')).toBeInTheDocument()
  })
})

describe('メールアドレスを確認した会員が、ログインが要る画面を開く', () => {
  it('その画面が出る（FR-UI-011）', () => {
    state = { status: 'signedIn', account: { userId: 'u', email: 'u@example.test', emailVerified: true } }

    renderAt('/home')

    expect(screen.getByText('ホームの画面')).toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が、ログインが要る画面を開く', () => {
  it('画面の代わりに「確認待ち」が出る（FR-AUTH-021・FR-UI-014）', () => {
    state = unverified

    renderAt('/home')

    expect(screen.getByText('この機能は使えません')).toBeInTheDocument()
    expect(screen.queryByText('ホームの画面')).not.toBeInTheDocument()
  })

  it('「確認した」を押すと、確認したかを読み直す（FR-UI-014）', async () => {
    state = unverified
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認した' }))

    expect(retry).toHaveBeenCalledTimes(1)
  })

  // axios に移したため（ブラウザの fetch を偽物にしても、axios は XMLHttpRequest で送るので届かない）。#290 で MSW に書き直す
  it.skip('「ログアウト」を押すと、ログアウトの API を呼び、204 のあとでログインの画面へ移る（FR-UI-014・FR-AUTH-016）', async () => {
    state = unverified
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(signOut).toHaveBeenCalledTimes(1)
    const logout = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/auth/logout'))
    expect(logout?.[1]?.method).toBe('POST')
    expect(screen.getByText('ログインの画面')).toBeInTheDocument()
  })

  // axios に移したため（ブラウザの fetch を偽物にしても、axios は XMLHttpRequest で送るので届かない）。#290 で MSW に書き直す
  it.skip('ログアウトの API が失敗したら、ログアウトした状態にせず、「ログアウトできませんでした」を出す（Cookie が生きたままなので）', async () => {
    state = unverified
    fetchMock.mockResolvedValue(jsonResponse(500))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(await screen.findByText('ログアウトできませんでした。もう一度お試しください')).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    expect(screen.queryByText('ログインの画面')).not.toBeInTheDocument()
  })

  // axios に移したため（ブラウザの fetch を偽物にしても、axios は XMLHttpRequest で送るので届かない）。#290 で MSW に書き直す
  it.skip('「確認のメールをもう一度送る」を押すと、自分のメールアドレスで送り直し、送ったことを出す（FR-UI-014）', async () => {
    state = unverified
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    const sent = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/email-verifications'))
    expect(sent?.[1]?.body).toBe(JSON.stringify({ email: 'u@example.test' }))
    expect(await screen.findByText('確認のメールを送りました')).toBeInTheDocument()
  })

  // axios に移したため（ブラウザの fetch を偽物にしても、axios は XMLHttpRequest で送るので届かない）。#290 で MSW に書き直す
  it.skip('送り直しの API が失敗したら、「送れませんでした」を出す（FR-UI-014）', async () => {
    state = unverified
    fetchMock.mockResolvedValue(jsonResponse(500))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    expect(await screen.findByText('送れませんでした')).toBeInTheDocument()
  })

  // axios に移したため（ブラウザの fetch を偽物にしても、axios は XMLHttpRequest で送るので届かない）。#290 で MSW に書き直す
  it.skip('送り直しのときにつながらなければ、「送れませんでした」を出す（FR-UI-014）', async () => {
    state = unverified
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    expect(await screen.findByText('送れませんでした')).toBeInTheDocument()
  })
})
