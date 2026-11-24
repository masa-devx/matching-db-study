import type { LikeResult, ReceivedLike, SkippedMember } from '../features/likes/types'
import { ageFromBirthday } from '../shared/lib/date'
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
  // いいねを送る（画面の形）。届いたいいね・相手のプロフィール・検索の画面が使う
  like: async (userId: string): Promise<LikeResult> => {
    const { data } = await client.post<LikeResponse>('/api/me/likes', { user_id: userId })
    return { matched: data.matched, roomId: data.room_id ?? null }
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  sentLikes: async (): Promise<SentLikeResponse[]> => {
    const { data } = await client.get<SentLikeResponse[]>('/api/me/likes')
    return data
  },

  // 届いたいいねの一覧（画面の形）
  receivedLikes: async (): Promise<ReceivedLike[]> => {
    const { data } = await client.get<ReceivedLikeResponse[]>('/api/me/received-likes')
    return data.map((like) => ({
      userId: like.user_id,
      nickname: like.nickname,
      age: like.birthday ? ageFromBirthday(like.birthday) : null,
      prefecture: like.prefecture,
      image: like.image,
      likedAt: new Date(like.liked_at),
    }))
  },

  skip: async (userId: string): Promise<void> => {
    await client.post('/api/me/skips', { user_id: userId })
  },

  // スキップした相手の一覧（画面の形）。
  // 分かっている不具合：同じ相手を2回スキップすると、API が2行返す（表に UNIQUE がない）。行を見分けるため、key に順番を足す
  skips: async (): Promise<SkippedMember[]> => {
    const { data } = await client.get<SkipResponse[]>('/api/me/skips')
    return data.map((skip, index) => ({
      key: `${skip.user_id}-${index}`,
      userId: skip.user_id,
      nickname: skip.nickname,
      age: skip.birthday ? ageFromBirthday(skip.birthday) : null,
      prefecture: skip.prefecture,
      image: skip.image,
      skippedAt: new Date(skip.skipped_at),
    }))
  },

  // スキップを元に戻す
  restoreSkip: async (userId: string): Promise<void> => {
    await client.delete(`/api/me/skips/${userId}`)
  },

  block: async (userId: string): Promise<void> => {
    await client.post('/api/me/blocks', { user_id: userId })
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  blocks: async (): Promise<BlockResponse[]> => {
    const { data } = await client.get<BlockResponse[]>('/api/me/blocks')
    return data
  },

  unblock: async (userId: string): Promise<void> => {
    await client.delete(`/api/me/blocks/${userId}`)
  },
}
