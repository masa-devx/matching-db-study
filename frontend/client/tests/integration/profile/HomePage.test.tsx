import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiUrl } from '../../../src/api/client'
import { ToastProvider } from '../../../src/components/Toast'
import HomePage from '../../../src/HomePage'
import { stubDialog } from '../../support/dialog'
import { sentRequests, server } from '../../support/server'

// HomePage.tsx のログアウトのボタン（FR-UI-023・FR-AUTH-016）。ホームのほかの動きは、画面を移すときに確かめる。
// API は MSW で偽物にする（自分・プロフィール・ログアウトの 204 が既定）

// テストで使う値
const signOut = vi.fn()

vi.mock('../../../src/shared/session/SessionProvider', () => ({
  useSession: () => ({ signOut }),
}))

const renderHome = () => {
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

const pressLogout = async (): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: 'ログアウト' }))
  await userEvent.click(screen.getByRole('button', { name: 'ログアウトする' }))
}

beforeAll(() => {
  stubDialog()
})

beforeEach(() => {
  signOut.mockReset()
})

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、ホームで「ログアウト」を押し、確かめで「ログアウトする」を選ぶ', () => {
  it('ログアウトの API を呼び、204 のあとでログインの画面へ移る（FR-AUTH-016）', async () => {
    renderHome()

    await pressLogout()

    expect(await screen.findByText('ログインの画面')).toBeInTheDocument()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(sentRequests('POST', '/api/auth/logout')).toHaveLength(1)
  })
})

describe('ログインした会員が、ホームで「ログアウト」を押し、確かめで「キャンセル」を選ぶ', () => {
  it('ログアウトの API を呼ばず、ログアウトしない', async () => {
    renderHome()

    await userEvent.click(await screen.findByRole('button', { name: 'ログアウト' }))
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(sentRequests('POST', '/api/auth/logout')).toHaveLength(0)
    expect(signOut).not.toHaveBeenCalled()
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員がホームでログアウトし、ログアウトの API が失敗する（500）', () => {
  it('ホームのまま「ログアウトできませんでした」を出す（Cookie が生きたままなので）', async () => {
    server.use(http.post(apiUrl('/api/auth/logout'), () => new HttpResponse(null, { status: 500 })))
    renderHome()

    await pressLogout()

    expect(await screen.findByText('ログアウトできませんでした。もう一度お試しください')).toBeInTheDocument()
    expect(screen.queryByText('ログインの画面')).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })
})
