import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiUrl } from '../../../src/api/client'
import { RequireAuth } from '../../../src/app/RequireAuth'
import { ToastProvider } from '../../../src/components/Toast'
import type { SessionState } from '../../../src/shared/session/types'
import { sentRequests, server } from '../../support/server'

// app/RequireAuth.tsx：ログインが要る画面の守り。ログインしていない・確認していない・使える会員の出し分け（FR-UI-011・FR-AUTH-021）。
// ログインした自分は偽物にし、API（ログアウト・確認のメールの再送）は MSW で偽物にする

// テストで使う値
const retry = vi.fn()
const signOut = vi.fn()
let state: SessionState = { status: 'signedOut' }

vi.mock('../../../src/shared/session/SessionProvider', () => ({
  useSession: () => ({ session: state, retry, signIn: vi.fn(), signOut }),
}))

const verified: SessionState = {
  status: 'signedIn',
  account: { userId: 'u', email: 'u@example.test', emailVerified: true },
}

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

beforeEach(() => {
  retry.mockReset()
  signOut.mockReset()
})

/**
 * 正常系：要件が通す操作
 */
describe('メールアドレスを確認した会員が、ログインが要る画面を開く', () => {
  it('その画面が出る（FR-UI-011）', () => {
    state = verified

    renderAt('/home')

    expect(screen.getByText('ホームの画面')).toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が、確認待ちの画面で「確認した」を押す', () => {
  it('確認したかを読み直す（FR-UI-014）', async () => {
    state = unverified
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認した' }))

    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('メールアドレスを確認していない会員が、確認待ちの画面で「ログアウト」を押す', () => {
  it('ログアウトの API を呼び、204 のあとでログインの画面へ移る（FR-UI-014・FR-AUTH-016）', async () => {
    state = unverified
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(await screen.findByText('ログインの画面')).toBeInTheDocument()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(sentRequests('POST', '/api/auth/logout')).toHaveLength(1)
  })
})

describe('メールアドレスを確認していない会員が、確認待ちの画面で「確認のメールをもう一度送る」を押す', () => {
  it('自分のメールアドレスで送り直し、送ったことを出す（FR-UI-014）', async () => {
    state = unverified
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    expect(await screen.findByText('確認のメールを送りました')).toBeInTheDocument()
    const [sent] = sentRequests('POST', '/api/email-verifications')
    expect(await sent?.json()).toEqual({ email: 'u@example.test' })
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、ログインが要る画面を開く', () => {
  it('その画面は出さず、ログインの画面へ移る（FR-UI-011）', () => {
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

  it('移るときは履歴を置き換えるので、ログインの画面で戻ると、その前の画面に戻る（FR-UI-011）', async () => {
    state = { status: 'signedOut' }
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '戻る' }))

    expect(screen.getByText('はじめの画面')).toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が、ログインが要る画面を開く', () => {
  it('画面の代わりに「確認待ち」が出る（FR-AUTH-021・FR-UI-014）', () => {
    state = unverified

    renderAt('/home')

    expect(screen.getByText('この機能は使えません')).toBeInTheDocument()
    expect(screen.queryByText('ホームの画面')).not.toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が「ログアウト」を押し、ログアウトの API が失敗する', () => {
  it('ログアウトした状態にせず、「ログアウトできませんでした」を出す（Cookie が生きたままなので）', async () => {
    state = unverified
    server.use(http.post(apiUrl('/api/auth/logout'), () => HttpResponse.json({}, { status: 500 })))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(await screen.findByText('ログアウトできませんでした。もう一度お試しください')).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    expect(screen.queryByText('ログインの画面')).not.toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が「確認のメールをもう一度送る」を押し、送れない', () => {
  it('送り直しの API が失敗したら、「送れませんでした」を出す（FR-UI-014）', async () => {
    state = unverified
    server.use(http.post(apiUrl('/api/email-verifications'), () => HttpResponse.json({}, { status: 500 })))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    expect(await screen.findByText('送れませんでした')).toBeInTheDocument()
  })

  it('つながらなければ、「送れませんでした」を出す（FR-UI-014）', async () => {
    state = unverified
    server.use(http.post(apiUrl('/api/email-verifications'), () => HttpResponse.error()))
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    expect(await screen.findByText('送れませんでした')).toBeInTheDocument()
  })
})
