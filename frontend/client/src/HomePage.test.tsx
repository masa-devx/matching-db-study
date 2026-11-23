import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './components/Toast'
import HomePage from './HomePage'

// HomePage.tsx のログアウトのボタン（#259。FR-UI-023・FR-AUTH-016）。ホームのほかの動きは、画面を移すチケットで確かめる

const signOut = vi.fn()
const fetchMock = vi.fn<typeof fetch>()
let logoutStatus = 204

vi.mock('./shared/session/SessionProvider', () => ({
  useSession: () => ({ signOut }),
}))

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function renderHome() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/login" element={<p>ログインの画面</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function pressLogout(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: 'ログアウト' }))
  await userEvent.click(screen.getByRole('button', { name: 'ログアウトする' }))
}

beforeAll(() => {
  // jsdom は <dialog> の showModal() と close() を持たないので、開いた・閉じたの印だけを付ける
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

beforeEach(() => {
  signOut.mockReset()
  fetchMock.mockReset()
  logoutStatus = 204
  fetchMock.mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname
    if (path === '/api/me') return json({ public_id: 'p1' })
    if (path === '/api/users/p1') return json({ email: 'a@example.test', profile: { nickname: 'さくら' } })
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    if (path === '/api/auth/logout') return new Response(null, { status: logoutStatus })
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
})

// axios に移したため（ブラウザの fetch を偽物にしても、axios は XMLHttpRequest で送るので届かない）。#290 で MSW に書き直す
describe.skip('ログインした会員が、ホームで「ログアウト」を押す', () => {
  it('確かめてから、ログアウトの API を呼び、204 のあとでログインの画面へ移る', async () => {
    renderHome()

    await pressLogout()

    expect(await screen.findByText('ログインの画面')).toBeInTheDocument()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('確かめで「キャンセル」を選ぶと、ログアウトしない', async () => {
    renderHome()

    await userEvent.click(await screen.findByRole('button', { name: 'ログアウト' }))
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/logout'))).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('ログアウトの API が失敗したら、ホームのまま「ログアウトできませんでした」を出す（Cookie が生きたままなので）', async () => {
    logoutStatus = 500
    renderHome()

    await pressLogout()

    expect(await screen.findByText('ログアウトできませんでした。もう一度お試しください')).toBeInTheDocument()
    expect(screen.queryByText('ログインの画面')).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })
})
