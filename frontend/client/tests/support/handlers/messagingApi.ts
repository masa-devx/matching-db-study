import { HttpResponse, http } from 'msw'
import { apiUrl } from '../../../src/api/client'

// Messaging（src/api/messagingApi.ts）の偽の応答。形は docs/api/05-messages.md の改善版の例と同じ。
// テストごとに違う応答（失敗・ほかの数）は、そのテストの中で server.use(...) で上書きする

type BadgeCountsBody = {
  unread_messages: number
  new_matches: number
  received_likes: number
}

// GET /api/me/badge-counts の応答の例（docs/api/05-messages.md の GET /api/me/badge-counts）
export const badgeCountsBody: BadgeCountsBody = { unread_messages: 3, new_matches: 1, received_likes: 2 }

// テストの中で上書きするときの URL
export const BADGE_COUNTS_URL = apiUrl('/api/me/badge-counts')

export const messagingHandlers = [
  // 下のタブのバッジの数
  http.get(BADGE_COUNTS_URL, () => HttpResponse.json(badgeCountsBody)),
]
