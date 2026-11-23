import type { BadgeCounts } from '../features/messages/types'
import { client } from './client'

// Messaging（docs/backend.md の2章）：トークルーム・メッセージ・下のタブの数・Firestore のトークン

// GET /api/me/talk-rooms の1件（docs/api/05-messages.md）
type TalkRoomResponse = {
  room_id: string
  user_id: string
  nickname: string | null
  birthday: string | null
  image: string | null
  last_message: { body: string; created_at: string; mine: boolean } | null
  unread_count: number
  last_read_at: string | null
  partner_last_read_at: string | null
  created_at: string
}

// GET /api/me/talk-rooms/{id}/messages の1件（新しい順。1ページに50件）
type MessageResponse = {
  id: number
  talk_room_id: number
  sender_id: number
  body: string
  created_at: string
  updated_at: string
}

// GET /api/me/badge-counts の応答（docs/api/05-messages.md の「#247」）
type BadgeCountsResponse = {
  unread_messages: number
  new_matches: number
  received_likes: number
}

// POST /api/me/firebase-token の応答（docs/api/05c-firestore.md）。uid は会員の public_id
type FirebaseTokenResponse = {
  token: string
  uid: string
}

export const messagingApi = {
  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  talkRooms: async (): Promise<TalkRoomResponse[]> => {
    const { data } = await client.get<TalkRoomResponse[]>('/api/me/talk-rooms')
    return data
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  messages: async (roomId: string, page: number): Promise<MessageResponse[]> => {
    const { data } = await client.get<MessageResponse[]>(`/api/me/talk-rooms/${roomId}/messages`, { params: { page } })
    return data
  },

  sendMessage: async (roomId: string, body: string): Promise<void> => {
    await client.post(`/api/me/talk-rooms/${roomId}/messages`, { body })
  },

  // 下のタブのバッジの数（画面の形）。2xx でないときは、client.ts が投げる（401・503 は client.ts が先に扱う）
  badgeCounts: async (signal?: AbortSignal): Promise<BadgeCounts> => {
    const { data } = await client.get<BadgeCountsResponse>('/api/me/badge-counts', { signal })
    return { unreadMessages: data.unread_messages, newMatches: data.new_matches, receivedLikes: data.received_likes }
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  // Firebase にログインするためのカスタムトークン
  firebaseToken: async (): Promise<FirebaseTokenResponse> => {
    const { data } = await client.post<FirebaseTokenResponse>('/api/me/firebase-token')
    return data
  },
}
