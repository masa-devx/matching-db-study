import { client } from './client'

// Matching（docs/backend.md の2章）：いいね・届いたいいね・スキップ・マッチ・ブロック

// POST /api/me/likes の応答（docs/api/02-likes.md の「03 で変えること」）。マッチしたら、トークルームの ID（M3。#187）
type LikeResponse = {
  matched: boolean
  room_id?: string | null
}

// GET /api/me/likes の1件（送った相手）
type SentLikeResponse = {
  user_id: string
  nickname: string | null
  birthday: string | null
  image: string | null
  liked_at: string
  matched: boolean
  room_id: string | null
}

// GET /api/me/received-likes の1件（届いたいいね）
type ReceivedLikeResponse = {
  user_id: string
  nickname: string | null
  birthday: string | null
  prefecture: string | null
  image: string | null
  liked_at: string
}

// GET /api/me/skips の1件
type SkipResponse = {
  user_id: string
  nickname: string | null
  birthday: string | null
  prefecture: string | null
  image: string | null
  skipped_at: string
}

// GET /api/me/blocks の1件（docs/api/06-blocks-withdrawal.md）
type BlockResponse = {
  user_id: string
  nickname: string | null
  image: string | null
  blocked_at: string
}

export const matchingApi = {
  like: async (userId: string): Promise<LikeResponse> => {
    const { data } = await client.post<LikeResponse>('/api/me/likes', { user_id: userId })
    return data
  },

  sentLikes: async (): Promise<SentLikeResponse[]> => {
    const { data } = await client.get<SentLikeResponse[]>('/api/me/likes')
    return data
  },

  receivedLikes: async (): Promise<ReceivedLikeResponse[]> => {
    const { data } = await client.get<ReceivedLikeResponse[]>('/api/me/received-likes')
    return data
  },

  skip: async (userId: string): Promise<void> => {
    await client.post('/api/me/skips', { user_id: userId })
  },

  skips: async (): Promise<SkipResponse[]> => {
    const { data } = await client.get<SkipResponse[]>('/api/me/skips')
    return data
  },

  // スキップを元に戻す
  restoreSkip: async (userId: string): Promise<void> => {
    await client.delete(`/api/me/skips/${userId}`)
  },

  block: async (userId: string): Promise<void> => {
    await client.post('/api/me/blocks', { user_id: userId })
  },

  blocks: async (): Promise<BlockResponse[]> => {
    const { data } = await client.get<BlockResponse[]>('/api/me/blocks')
    return data
  },

  unblock: async (userId: string): Promise<void> => {
    await client.delete(`/api/me/blocks/${userId}`)
  },
}
