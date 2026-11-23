import { client } from './client'

// Auth（docs/backend.md の2章）：新規登録・ログイン・ログアウト・メールアドレスの確認・パスワード。
// ログインが要らない API は access: 'withoutLogin'（401 でもログインの画面へ移さず、ApiError を投げる）

type RegisterInput = {
  email: string
  password: string
  nickname: string
  gender: string
  birthday: string
}

export const authApi = {
  // 新規登録（POST /api/users。docs/api/01b-auth.md）
  register: async (input: RegisterInput): Promise<void> => {
    await client.post('/api/users', input, { access: 'withoutLogin' })
  },

  // メールアドレスを確認する（GET /api/email-verifications/{token}）
  verifyEmail: async (token: string): Promise<void> => {
    await client.get(`/api/email-verifications/${token}`, { access: 'withoutLogin' })
  },

  // 確認のメールをもう一度送る（POST /api/email-verifications）。ログインしていなくても呼べる
  resendVerification: async (email: string): Promise<void> => {
    await client.post('/api/email-verifications', { email }, { access: 'withoutLogin' })
  },

  // ログイン（POST /api/auth/login）。セッションの Cookie は HttpOnly なので、応答の中身は使わない（D-027）
  login: async (email: string, password: string): Promise<void> => {
    await client.post('/api/auth/login', { email, password }, { access: 'withoutLogin' })
  },

  // ログアウト（POST /api/auth/logout）。204 で終わる。401・419 は ApiError（もうセッションがない）
  logout: async (): Promise<void> => {
    await client.post('/api/auth/logout', undefined, { access: 'logout' })
  },

  // パスワードの再設定のメールを送る（POST /api/password-resets）
  requestPasswordReset: async (email: string): Promise<void> => {
    await client.post('/api/password-resets', { email }, { access: 'withoutLogin' })
  },

  // 新しいパスワードにする（PUT /api/password-resets/{token}）
  resetPassword: async (token: string, password: string): Promise<void> => {
    await client.put(`/api/password-resets/${token}`, { password }, { access: 'withoutLogin' })
  },

  // ログインした会員が、パスワードを変える（PUT /api/me/password。FR-AUTH-033）
  changePassword: async (currentPassword: string, password: string): Promise<void> => {
    await client.put('/api/me/password', { current_password: currentPassword, password })
  },
}
