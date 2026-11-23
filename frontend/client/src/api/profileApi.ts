import type { Account } from '../shared/session/SessionProvider'
import { client } from './client'

// Profile（docs/backend.md の2章）：自分のアカウント（/me）・相手のプロフィール・プロフィールを直す・退会

// GET /api/me の応答（users の行。docs/api/01b-auth.md）
type AccountResponse = {
  id: number
  public_id: string
  email: string
  email_verified_at: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
  deleted_at: string | null
  is_paid: boolean
  paid_until: string | null
  suspended_at: string | null
  suspended_reason: string | null
  banned_at: string | null
  banned_reason: string | null
}

// プロフィールの行（docs/api/01-members.md）
type ProfileResponse = {
  id: number
  user_id: number
  nickname: string | null
  gender: string | null
  birthday: string | null
  prefecture: string | null
  height: string | null
  introduction: string | null
  image: string | null
  body_type: string | null
  job: string | null
  income: string | null
  smoking: string | null
  drinking: string | null
  marital_status: string | null
  created_at: string
  updated_at: string
}

// GET /api/users/{public_id} の応答。もうマッチしていれば room_id（M3。#187）
type MemberResponse = AccountResponse & {
  profile: ProfileResponse | null
  room_id?: string | null
}

// PUT /api/users/{public_id} で送る項目。選ばなければ空の文字（API が null に直す。#153）
type ProfileInput = {
  nickname?: string | null
  prefecture?: string | null
  height?: string | number | null
  body_type?: string | null
  job?: string | null
  income?: string | null
  smoking?: string | null
  drinking?: string | null
  marital_status?: string | null
  introduction?: string | null
  image?: string | null
}

export const profileApi = {
  // ログインした自分（画面の形）。起動のときと、ログインのあとに shared/session が読む。
  // 401 でもログインの画面へは移さない（ログインの画面・登録の画面も、この下にあるため）ので、access: 'withoutLogin'
  account: async (signal?: AbortSignal): Promise<Account> => {
    const { data } = await client.get<AccountResponse>('/api/me', { access: 'withoutLogin', signal })
    return { userId: data.public_id, email: data.email, emailVerified: data.email_verified_at !== null }
  },

  // ログインした自分の行（API の形のまま）。まだ移していないレガシー版の画面が、is_paid・paid_until などを読む
  accountRecord: async (): Promise<AccountResponse> => {
    const { data } = await client.get<AccountResponse>('/api/me')
    return data
  },

  // 会員とプロフィール（API の形のまま。レガシー版の画面が読む）
  member: async (userId: string): Promise<MemberResponse> => {
    const { data } = await client.get<MemberResponse>(`/api/users/${userId}`)
    return data
  },

  // 自分のプロフィールを直す。応答は直したあとのプロフィール
  updateProfile: async (userId: string, input: ProfileInput): Promise<ProfileResponse> => {
    const { data } = await client.put<ProfileResponse>(`/api/users/${userId}`, input)
    return data
  },

  // 退会する（DELETE /api/me。パスワードが違えば 422）
  withdraw: async (password: string): Promise<void> => {
    await client.delete('/api/me', { data: { password } })
  },
}
