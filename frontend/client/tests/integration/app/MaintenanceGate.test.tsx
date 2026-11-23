import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { messagingApi } from '../../../src/api/messagingApi'
import { configureApi } from '../../../src/app/configureApi'
import { MaintenanceGate } from '../../../src/app/MaintenanceGate'
import { SessionGate } from '../../../src/app/SessionGate'
import { SessionProvider } from '../../../src/shared/session/SessionProvider'
import { BADGE_COUNTS_URL } from '../../support/handlers/messagingApi'
import { server } from '../../support/server'

// app/MaintenanceGate.tsx：メンテナンス中なら、どの画面の代わりにもメンテナンスの画面を出す（FR-MAINT-006）。
// main.tsx と同じ組み立てで描く。メンテナンス中かはファイルの中に1つだけ持ち、入ったら戻らないので、テストは1本にする

// テストで使う値
// 画面の中身の代わり。押すと、ログインしたあとの API（下のタブの数）を呼ぶ
const ScreenUsingApi = () => {
  return (
    <>
      <p>画面の中身</p>
      <button
        type="button"
        onClick={() => {
          // 失敗は、メンテナンスの画面が出るかで確かめる（続きは client.ts が止める）
          messagingApi.badgeCounts().catch(() => {})
        }}
      >
        数を読み直す
      </button>
    </>
  )
}

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員が画面を使っている途中で、メンテナンスに入り、API が 503 を返す', () => {
  it('それまでの画面の代わりに「ただいまメンテナンス中です」を出し、読み上げのために見出しにフォーカスを移す（FR-MAINT-006）', async () => {
    configureApi()
    render(
      <MaintenanceGate>
        <SessionProvider>
          <SessionGate>
            <ScreenUsingApi />
          </SessionGate>
        </SessionProvider>
      </MaintenanceGate>,
    )
    expect(await screen.findByText('画面の中身')).toBeInTheDocument()
    server.use(
      http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ message: 'ただいまメンテナンス中です' }, { status: 503 })),
    )

    await userEvent.click(screen.getByRole('button', { name: '数を読み直す' }))

    const heading = await screen.findByRole('heading', { name: 'ただいまメンテナンス中です' })
    expect(heading).toHaveFocus()
    expect(document.title).toBe('メンテナンス中｜matching')
    expect(screen.queryByText('画面の中身')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読み込み直す' })).toBeInTheDocument()
  })
})
