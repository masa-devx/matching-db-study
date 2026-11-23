import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { SessionGate } from '../../../src/app/SessionGate'
import { SessionProvider } from '../../../src/shared/session/SessionProvider'
import { ME_URL } from '../../support/handlers/profileApi'
import { sentRequests, server } from '../../support/server'

// app/SessionGate.tsx：ログインしているかが決まるまでと、読み込めなかったときの見せ方（FR-UI-013）。
// 本物の SessionProvider が起動のときに GET /api/me を読む。API は MSW で偽物にする（既定は、メールアドレスを確認した会員）

// テストで使う値
const renderGate = () => {
  return render(
    <SessionProvider>
      <SessionGate>
        <p>画面の中身</p>
      </SessionGate>
    </SessionProvider>,
  )
}

/**
 * 正常系：要件が通す操作
 */
describe('会員がアプリを開き、ログインしているかを読んでいる途中', () => {
  it('「読み込み中…」を出し、画面の中身は出さない（FR-UI-013）', async () => {
    // 応答を返さないまま、読み込み中の画面を見る
    server.use(http.get(ME_URL, () => new Promise<Response>(() => {})))

    renderGate()
    // 要求が偽物に届くまで待つ（待たずに終えると、届くのが次のテストになり、次のテストの偽の応答を使ってしまう）
    await vi.waitFor(() => expect(sentRequests('GET', '/api/me')).toHaveLength(1))

    expect(screen.getByText('読み込み中…')).toBeInTheDocument()
    expect(screen.queryByText('画面の中身')).not.toBeInTheDocument()
  })
})

describe('ログインした会員が、アプリを開く', () => {
  it('画面の中身を出す', async () => {
    renderGate()

    expect(await screen.findByText('画面の中身')).toBeInTheDocument()
    expect(screen.queryByText('読み込み中…')).not.toBeInTheDocument()
  })
})

describe('ログインしていない人が、アプリを開く（401）', () => {
  it('画面の中身を出す（ログインの画面などを出すのは、そのあとの App と RequireAuth）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json({ message: 'ログインしてください' }, { status: 401 })))

    renderGate()

    expect(await screen.findByText('画面の中身')).toBeInTheDocument()
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('会員がアプリを開き、ログインしているかを読めない（500）', () => {
  it('「読み込めませんでした」と、もう一度のボタンを出す。押すと読み直し、読めれば画面の中身を出す（FR-UI-013）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json({ message: 'Server Error' }, { status: 500 }), { once: true }))
    renderGate()

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした')
    expect(screen.queryByText('画面の中身')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'もう一度' }))

    expect(await screen.findByText('画面の中身')).toBeInTheDocument()
    expect(sentRequests('GET', '/api/me')).toHaveLength(2)
  })
})

describe('会員がアプリを開き、API につながらない', () => {
  it('「読み込めませんでした」を出す（FR-UI-013）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.error()))

    renderGate()

    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした')
  })
})
