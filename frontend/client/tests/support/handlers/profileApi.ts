import { HttpResponse, http } from 'msw'
import { apiUrl } from '../../../src/api/client'

// Profile（src/api/profileApi.ts）の偽の応答。形は docs/api/01b-auth.md・01-members.md の改善版の例と同じ。
// テストごとに違う応答（失敗・別の会員・確認していない会員）は、そのテストの中で server.use(...) で上書きする

type AccountOptions = {
  publicId?: string
  verified?: boolean
}

// GET /api/me の応答（docs/api/01b-auth.md の「改善版の今」。users の行）
export const accountBody = ({ publicId = 'user-a', verified = true }: AccountOptions = {}) => {
  return {
    id: 1,
    public_id: publicId,
    email: `${publicId}@example.test`,
    email_verified_at: verified ? '2026-11-01T00:00:00.000000Z' : null,
    created_at: '2026-11-01T00:00:00.000000Z',
    updated_at: '2026-11-01T00:00:00.000000Z',
    last_login_at: '2026-11-20T09:00:00.000000Z',
    deleted_at: null,
    is_paid: false,
    paid_until: null,
    suspended_at: null,
    suspended_reason: null,
    banned_at: null,
    banned_reason: null,
  }
}

// GET /api/users/{public_id} の応答（docs/api/01-members.md。会員の行の中にプロフィールの行）
export const memberBody = (publicId = 'user-a') => {
  return {
    ...accountBody({ publicId }),
    profile: {
      id: 1,
      user_id: 1,
      nickname: 'さくら',
      gender: 'female',
      birthday: '1996-04-01',
      prefecture: '東京都',
      height: null,
      introduction: null,
      image: null,
      body_type: null,
      job: null,
      income: null,
      smoking: null,
      drinking: null,
      marital_status: null,
      created_at: '2026-11-01T00:00:00.000000Z',
      updated_at: '2026-11-01T00:00:00.000000Z',
    },
    room_id: null,
  }
}

// テストの中で上書きするときの URL
export const ME_URL = apiUrl('/api/me')

export const profileHandlers = [
  // ログインした自分（メールアドレスを確認した会員）
  http.get(ME_URL, () => HttpResponse.json(accountBody())),

  // 会員とプロフィール
  http.get(apiUrl('/api/users/:publicId'), ({ params }) => HttpResponse.json(memberBody(String(params.publicId)))),
]
