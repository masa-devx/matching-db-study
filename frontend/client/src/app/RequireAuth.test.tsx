import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import type { SessionState } from '../shared/session/SessionProvider'
import RequireAuth from './RequireAuth'

// app/RequireAuth.tsx：ログインが要る画面の守り。ログインしていない・確認していない・使える会員の出し分け（FR-UI-011・FR-AUTH-021）

const retry = vi.fn()
const signOut = vi.fn()
let state: SessionState = { status: 'signedOut' }

vi.mock('../shared/session/SessionProvider', () => ({
  useSession: () => ({ session: state, retry, signIn: vi.fn(), signOut }),
}))

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<p>ログインの画面</p>} />
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
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })))
})

describe('ログインしていない人が、ログインが要る画面を開く', () => {
  it('ログインの画面へ移る（FR-UI-011）', () => {
    state = { status: 'signedOut' }

    renderAt('/home')

    expect(screen.getByText('ログインの画面')).toBeInTheDocument()
    expect(screen.queryByText('ホームの画面')).not.toBeInTheDocument()
  })
})

describe('メールアドレスを確認した会員が、ログインが要る画面を開く', () => {
  it('その画面が出る', () => {
    state = { status: 'signedIn', account: { userId: 'u', email: 'u@example.test', emailVerified: true } }

    renderAt('/home')

    expect(screen.getByText('ホームの画面')).toBeInTheDocument()
  })
})

describe('メールアドレスを確認していない会員が、ログインが要る画面を開く', () => {
  beforeEach(() => {
    state = { status: 'signedIn', account: { userId: 'u', email: 'u@example.test', emailVerified: false } }
  })

  it('画面の代わりに「確認待ち」が出る（FR-AUTH-021・FR-UI-014）', () => {
    renderAt('/home')

    expect(screen.getByText('この機能は使えません')).toBeInTheDocument()
    expect(screen.queryByText('ホームの画面')).not.toBeInTheDocument()
  })

  it('「確認した」を押すと、確認したかを読み直す', async () => {
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認した' }))

    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('「ログアウト」を押すと、ログアウトしてログインの画面へ移る', async () => {
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: 'ログアウト' }))

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('「確認のメールをもう一度送る」を押すと、自分のメールアドレスで送り直しの API を呼ぶ', async () => {
    renderAt('/home')

    await userEvent.click(screen.getByRole('button', { name: '確認のメールをもう一度送る' }))

    const fetchMock = vi.mocked(fetch)
    const sent = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/email-verifications'))
    expect(sent?.[1]?.body).toBe(JSON.stringify({ email: 'u@example.test' }))
  })
})
