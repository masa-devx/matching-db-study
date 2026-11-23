import { act, render, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { apiUrl } from '../../../src/api/client'
import TabBar from '../../../src/components/TabBar'
import { sentPaths, server } from '../../support/server'

// components/TabBar.tsx：下のタブのバッジ（FR-UI-032・FR-UI-064・FR-UI-073）。
// 数は、数だけを返す API（GET /api/me/badge-counts。docs/api/05-messages.md）を1本だけ読む。API は MSW で偽物にする

// テストで使う値
vi.mock('../../../src/shared/session/SessionProvider', () => ({
  useSession: () => ({
    session: { status: 'signedIn', account: { userId: 'u1', email: 'a@example.test', emailVerified: true } },
  }),
}))

const respond = (counts: { unread_messages: number; new_matches: number; received_likes: number }): void => {
  server.use(http.get(apiUrl('/api/me/badge-counts'), () => HttpResponse.json(counts)))
}

const renderAt = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TabBar />
    </MemoryRouter>,
  )
}

const tab = (name: string): HTMLElement => {
  return screen.getByRole('link', { name: new RegExp(name) })
}

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、検索の画面（/search）を開く', () => {
  it('タブの数のために呼ぶ API は、数だけを返す API の1本だけ（トークの一覧・届いたいいねの一覧は読まない）', async () => {
    respond({ unread_messages: 3, new_matches: 1, received_likes: 2 })

    renderAt('/search')

    expect(await within(tab('いいね')).findByText('2')).toBeInTheDocument()
    expect(sentPaths()).toEqual(['GET /api/me/badge-counts'])
  })

  it('メッセージのタブに、未読の合計と新しいマッチを足した数が出る（FR-UI-032・FR-UI-073）', async () => {
    respond({ unread_messages: 3, new_matches: 2, received_likes: 0 })

    renderAt('/search')

    expect(await within(tab('メッセージ')).findByText('5')).toBeInTheDocument()
  })

  it('いいねのタブに、届いたいいねの人数が出る（FR-UI-064）', async () => {
    respond({ unread_messages: 0, new_matches: 0, received_likes: 4 })

    renderAt('/search')

    expect(await within(tab('いいね')).findByText('4')).toBeInTheDocument()
  })

  it('100 以上は「99+」と出る（FR-UI-032）', async () => {
    respond({ unread_messages: 99, new_matches: 1, received_likes: 100 })

    renderAt('/search')

    expect(await within(tab('メッセージ')).findByText('99+')).toBeInTheDocument()
    expect(within(tab('いいね')).getByText('99+')).toBeInTheDocument()
  })

  it('99 までは、そのままの数が出る（「99+」の境目の下側。FR-UI-032）', async () => {
    respond({ unread_messages: 98, new_matches: 1, received_likes: 99 })

    renderAt('/search')

    expect(await within(tab('メッセージ')).findByText('99')).toBeInTheDocument()
    expect(within(tab('いいね')).getByText('99')).toBeInTheDocument()
  })

  it('0 なら、バッジは出ない（FR-UI-032）', async () => {
    let answered = false
    server.use(
      http.get(apiUrl('/api/me/badge-counts'), () => {
        answered = true
        return HttpResponse.json({ unread_messages: 0, new_matches: 0, received_likes: 0 })
      }),
    )

    renderAt('/search')

    await vi.waitFor(() => expect(answered).toBe(true))
    await act(async () => {}) // 応答を数として置くところまで進める
    expect(within(tab('メッセージ')).queryByText('0')).not.toBeInTheDocument()
    expect(within(tab('いいね')).queryByText('0')).not.toBeInTheDocument()
  })
})
