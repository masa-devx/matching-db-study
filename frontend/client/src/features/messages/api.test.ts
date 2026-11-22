import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchBadgeCounts } from './api'

// features/messages/api.ts：下のタブの数の API（GET /api/me/badge-counts）を読み、画面の形に変える。
// 応答の例は docs/api/05-messages.md の「#247 で足すこと」

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('ログインした会員の、下のタブの数を読む', () => {
  it('docs/api の応答の例を、画面の形（未読・新しいマッチ・届いたいいね）に変える', async () => {
    fetchMock.mockResolvedValue(json({ unread_messages: 3, new_matches: 1, received_likes: 2 }))

    expect(await fetchBadgeCounts()).toEqual({ unreadMessages: 3, newMatches: 1, receivedLikes: 2 })
    const [url] = fetchMock.mock.calls[0] ?? []
    expect(new URL(String(url)).pathname).toBe('/api/me/badge-counts')
  })

  it('渡した止める合図（AbortSignal）が、fetch まで届く（画面を移ったときに、古い読み込みを止めるため）', async () => {
    fetchMock.mockResolvedValue(json({ unread_messages: 0, new_matches: 0, received_likes: 0 }))
    const controller = new AbortController()

    await fetchBadgeCounts(controller.signal)

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(init?.signal).toBe(controller.signal)
  })

  it('200 でなければ、数として置かずに投げる', async () => {
    fetchMock.mockResolvedValue(json({ message: 'サーバーのエラー' }, 500))

    await expect(fetchBadgeCounts()).rejects.toThrow('下のタブの数を読めませんでした（500）')
  })

  it('応答の形が違えば（数でない項目がある）、数として置かずに投げる', async () => {
    fetchMock.mockResolvedValue(json({ unread_messages: '3', new_matches: 1, received_likes: 2 }))

    await expect(fetchBadgeCounts()).rejects.toThrow('下のタブの数の形が、docs/api/05-messages.md と違います')
  })
})
