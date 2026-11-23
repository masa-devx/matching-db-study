import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SessionState } from '../shared/session/SessionProvider'
import { SessionGate } from './SessionGate'

// app/SessionGate.tsx：ログインしているかが決まるまでと、読み込めなかったときの見せ方（FR-UI-013）

const retry = vi.fn()
let state: SessionState = { status: 'loading' }

vi.mock('../shared/session/SessionProvider', () => ({
  useSession: () => ({ session: state, retry, signIn: vi.fn(), signOut: vi.fn() }),
}))

const renderGate = () => {
  return render(
    <SessionGate>
      <p>画面の中身</p>
    </SessionGate>,
  )
}

describe('ログインしているかを、起動のときに読んでいる', () => {
  it('「読み込み中…」を出し、画面の中身は出さない（FR-UI-013）', () => {
    state = { status: 'loading' }

    renderGate()

    expect(screen.getByText('読み込み中…')).toBeInTheDocument()
    expect(screen.queryByText('画面の中身')).not.toBeInTheDocument()
  })
})

describe('起動のときに、読み込めなかった（500・つながらない）', () => {
  it('「読み込めませんでした」と、もう一度のボタンを出す。押すと読み直す（FR-UI-013）', async () => {
    state = { status: 'error' }
    retry.mockReset()

    renderGate()
    await userEvent.click(screen.getByRole('button', { name: 'もう一度' }))

    expect(screen.getByRole('alert')).toHaveTextContent('読み込めませんでした')
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

describe('ログインしているかが決まった', () => {
  it('ログインしていれば、画面の中身を出す', () => {
    state = { status: 'signedIn', account: { userId: 'u', email: 'u@example.test', emailVerified: true } }

    renderGate()

    expect(screen.getByText('画面の中身')).toBeInTheDocument()
  })

  it('ログインしていなくても、画面の中身を出す（ログインの画面などを出すのは、そのあとの App と RequireAuth）', () => {
    state = { status: 'signedOut' }

    renderGate()

    expect(screen.getByText('画面の中身')).toBeInTheDocument()
  })
})
