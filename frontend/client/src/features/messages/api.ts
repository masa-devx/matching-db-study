import { apiFetch } from '../../shared/api/client'
import type { BadgeCounts } from './types'

// GET /api/me/badge-counts の応答の形（docs/api/05-messages.md の「#247」）。このファイルの外へ出さない
type BadgeCountsResponse = {
  unread_messages: number
  new_matches: number
  received_likes: number
}

// 下のタブのバッジの数を読む。200 でない・形が違うときは投げる（401・503 は client.ts が先に扱う）
export async function fetchBadgeCounts(signal?: AbortSignal): Promise<BadgeCounts> {
  const res = await apiFetch('/api/me/badge-counts', { signal })
  if (!res.ok) {
    throw new Error(`下のタブの数を読めませんでした（${res.status}）`)
  }
  const body: unknown = await res.json()
  if (!isBadgeCountsResponse(body)) {
    throw new Error('下のタブの数の形が、docs/api/05-messages.md と違います')
  }
  return toBadgeCounts(body)
}

function isBadgeCountsResponse(value: unknown): value is BadgeCountsResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'unread_messages' in value &&
    typeof value.unread_messages === 'number' &&
    'new_matches' in value &&
    typeof value.new_matches === 'number' &&
    'received_likes' in value &&
    typeof value.received_likes === 'number'
  )
}

function toBadgeCounts(res: BadgeCountsResponse): BadgeCounts {
  return { unreadMessages: res.unread_messages, newMatches: res.new_matches, receivedLikes: res.received_likes }
}
