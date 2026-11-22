import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './components/Toast'
import SettingsPage from './SettingsPage'

// SettingsPage.tsx のパスワードの変更（FR-AUTH-033）。設定のほかの動きは、画面を移すチケットで確かめる

const fetchMock = vi.fn<typeof fetch>()
let passwordResponse: () => Response

vi.mock('./shared/session/SessionProvider', () => ({
  useSession: () => ({ signOut: vi.fn() }),
}))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function changePassword(): Promise<void> {
  render(
    <ToastProvider>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </ToastProvider>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'パスワードを変える' }))
  await userEvent.type(screen.getByLabelText('今のパスワード'), 'password')
  await userEvent.type(screen.getByLabelText('新しいパスワード（8〜64文字）'), 'short')
  await userEvent.type(screen.getByLabelText('新しいパスワード（もう一度）'), 'short')
  await userEvent.click(screen.getByRole('button', { name: '変える' }))
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
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname
    if (path === '/api/me') return json({ public_id: 'p1' })
    if (path === '/api/users/p1') return json({ email: 'a@example.test', profile: { nickname: 'さくら' } })
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    if (path === '/api/me/password') return passwordResponse()
    return json({})
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('ログインした会員が、設定でパスワードを変える', () => {
  it('新しいパスワードが決まりに合わず 422 なら、API が返した文を出す', async () => {
    passwordResponse = () =>
      json(
        {
          message: '新しいパスワードは8文字以上にしてください',
          errors: { password: ['新しいパスワードは8文字以上にしてください'] },
        },
        422,
      )

    await changePassword()

    expect(await screen.findByText('新しいパスワードは8文字以上にしてください')).toBeInTheDocument()
  })

  // 文は、画面が持たない文にする（画面に文を書き戻したときや、message だけを読むようになったときに落ちるように）
  it('今のパスワードが違い 422 なら、API が返した errors.current_password の文を出す', async () => {
    passwordResponse = () =>
      json(
        {
          message: 'テスト用の文：入力に誤りがあります',
          errors: { current_password: ['テスト用の文：今のパスワードが違う'] },
        },
        422,
      )

    await changePassword()

    expect(await screen.findByText('テスト用の文：今のパスワードが違う')).toBeInTheDocument()
    expect(screen.queryByText('テスト用の文：入力に誤りがあります')).not.toBeInTheDocument()
  })

  it('つながらないときは、通信を確かめる文を出し、ボタンをまた押せるようにする', async () => {
    passwordResponse = () => {
      throw new TypeError('Failed to fetch')
    }

    await changePassword()

    expect(await screen.findByText('変えられませんでした。通信を確かめて、もう一度お試しください')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '変える' })).toBeEnabled()
  })
})
