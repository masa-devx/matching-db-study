import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import { apiUrl } from '../../../src/api/client'
import { ToastProvider } from '../../../src/components/Toast'
import SettingsPage from '../../../src/SettingsPage'
import { SessionProvider } from '../../../src/shared/session/SessionProvider'
import { stubDialog } from '../../support/dialog'
import { sentRequests, server } from '../../support/server'

// SettingsPage.tsx のパスワードの変更（FR-AUTH-033）。設定のほかの動きは、画面を移すときに確かめる。
// 本物の SessionProvider で包み、API は MSW で偽物にする（自分・プロフィールが既定）。パスワードの変更の応答は、テストごとに上書きする

// テストで使う値
const CURRENT_PASSWORD = 'password'
// 決まり（8〜64文字）に合わない新しいパスワード
const SHORT_PASSWORD = 'short'

// PUT /api/me/password の 422 の形（docs/api/01b-auth.md）
type PasswordErrorBody = {
  message: string
  errors: Record<string, string[]>
}

const respondToPasswordChange = (body: PasswordErrorBody, status: number): void => {
  server.use(http.put(apiUrl('/api/me/password'), () => HttpResponse.json(body, { status })))
}

// 設定の画面を開き、パスワードを変えるダイアログに入れる（押すのはテストの中）
const fillPasswordForm = async (): Promise<void> => {
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'パスワードを変える' }))
  await userEvent.type(screen.getByLabelText('今のパスワード'), CURRENT_PASSWORD)
  await userEvent.type(screen.getByLabelText('新しいパスワード（8〜64文字）'), SHORT_PASSWORD)
  await userEvent.type(screen.getByLabelText('新しいパスワード（もう一度）'), SHORT_PASSWORD)
}

beforeAll(() => {
  stubDialog()
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員が、設定で、決まりに合わない新しいパスワードに変える（422）', () => {
  it('API が返した文を出す（FR-AUTH-033）', async () => {
    respondToPasswordChange(
      {
        message: '新しいパスワードは8文字以上にしてください',
        errors: { password: ['新しいパスワードは8文字以上にしてください'] },
      },
      422,
    )
    await fillPasswordForm()

    await userEvent.click(screen.getByRole('button', { name: '変える' }))

    expect(await screen.findByText('新しいパスワードは8文字以上にしてください')).toBeInTheDocument()
    const [sent] = sentRequests('PUT', '/api/me/password')
    expect(await sent?.json()).toEqual({ current_password: CURRENT_PASSWORD, password: SHORT_PASSWORD })
  })
})

describe('ログインした会員が、設定で、違う今のパスワードを入れて変える（422）', () => {
  // 文は、画面が持たない文にする（画面に文を書き戻したときや、message だけを読むようになったときに落ちるように）
  it('API が返した errors.current_password の文を出し、message の文は出さない（FR-AUTH-033）', async () => {
    respondToPasswordChange(
      {
        message: 'テスト用の文：入力に誤りがあります',
        errors: { current_password: ['テスト用の文：今のパスワードが違う'] },
      },
      422,
    )
    await fillPasswordForm()

    await userEvent.click(screen.getByRole('button', { name: '変える' }))

    expect(await screen.findByText('テスト用の文：今のパスワードが違う')).toBeInTheDocument()
    expect(screen.queryByText('テスト用の文：入力に誤りがあります')).not.toBeInTheDocument()
  })
})

describe('ログインした会員が、設定でパスワードを変え、API につながらない', () => {
  it('通信を確かめる文を出し、ボタンをまた押せるようにする', async () => {
    server.use(http.put(apiUrl('/api/me/password'), () => HttpResponse.error()))
    await fillPasswordForm()

    await userEvent.click(screen.getByRole('button', { name: '変える' }))

    expect(await screen.findByText('変えられませんでした。通信を確かめて、もう一度お試しください')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '変える' })).toBeEnabled()
  })
})
