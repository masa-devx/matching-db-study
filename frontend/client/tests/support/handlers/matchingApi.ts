import { HttpResponse, http } from 'msw'
import { apiUrl } from '../../../src/api/client'

// Matching（src/api/matchingApi.ts）の偽の応答。形は docs/api/02-likes.md の今の形（届いたいいね・スキップ・いいねを送る）。
// テストごとに違う応答（失敗・空・別の相手）は、そのテストの中で server.use(...) で上書きする

type ReceivedLikeBody = {
  user_id: string
  nickname: string | null
  birthday: string | null
  prefecture: string | null
  image: string | null
  liked_at: string
}

type SkipBody = {
  user_id: string
  nickname: string | null
  birthday: string | null
  prefecture: string | null
  image: string | null
  skipped_at: string
}

// GET /api/me/received-likes の1件（docs/api/02-likes.md の「GET /api/me/received-likes」のレガシー版。生年月日をそのまま返す）
export const receivedLikeBody = (overrides: Partial<ReceivedLikeBody> = {}): ReceivedLikeBody => {
  return {
    user_id: 'user-b',
    nickname: 'ゆき',
    birthday: '1996-04-01',
    prefecture: '東京都',
    image: null,
    liked_at: '2026-11-20T03:00:00.000000Z',
    ...overrides,
  }
}

// GET /api/me/skips の1件（docs/api/02-likes.md の「一覧」のレガシー版）
export const skipBody = (overrides: Partial<SkipBody> = {}): SkipBody => {
  return {
    user_id: 'user-d',
    nickname: 'みお',
    birthday: '1995-06-01',
    prefecture: '神奈川県',
    image: null,
    skipped_at: '2026-11-18T03:00:00.000000Z',
    ...overrides,
  }
}

// 既定の一覧：届いたいいねが2人（新しい順）、スキップした相手が1人
export const receivedLikesBody: ReceivedLikeBody[] = [
  receivedLikeBody(),
  receivedLikeBody({
    user_id: 'user-c',
    nickname: 'あおい',
    birthday: '1998-08-01',
    prefecture: '大阪府',
    liked_at: '2026-11-19T03:00:00.000000Z',
  }),
]
export const skipsBody: SkipBody[] = [skipBody()]

// POST /api/me/likes の応答（docs/api/02-likes.md。マッチしたら、トークルームの ID。#187）
export const LIKE_ROOM_ID = 'room-1'

// テストの中で上書きするときの URL
export const RECEIVED_LIKES_URL = apiUrl('/api/me/received-likes')
export const SKIPS_URL = apiUrl('/api/me/skips')
export const LIKES_URL = apiUrl('/api/me/likes')
export const SKIP_URL = apiUrl('/api/me/skips/:publicId')

export const matchingHandlers = [
  // 届いたいいねの一覧
  http.get(RECEIVED_LIKES_URL, () => HttpResponse.json(receivedLikesBody)),

  // スキップした相手の一覧
  http.get(SKIPS_URL, () => HttpResponse.json(skipsBody)),

  // いいねを送る（届いたいいねへの送り返しなので、マッチになる）
  http.post(LIKES_URL, () => HttpResponse.json({ matched: true, room_id: LIKE_ROOM_ID }, { status: 201 })),

  // スキップする（201。レガシー版は skips の行をそのまま返す）
  http.post(SKIPS_URL, () => HttpResponse.json({ id: 1, skipper_id: 1, skipped_id: 2 }, { status: 201 })),

  // スキップを元に戻す（204）
  http.delete(SKIP_URL, () => new HttpResponse(null, { status: 204 })),
]
