import type { ACCOUNT_SUSPENDED_REASON } from './session'

// ログインした自分の型（画面の形）。src/api/profileApi.ts も型だけ読むので、React を使うファイル（SessionProvider.tsx）から分けて置く

// ログインした自分のアカウント。名前は docs/glossary.md の「アカウント」（コードでは Me と呼ばない）。
// API の形（GET /api/me）から変えるのは src/api/profileApi.ts の account()
export type Account = {
  userId: string // users.public_id
  email: string
  emailVerified: boolean
}

// 読み込み中・ログインしている・していない・読み込めなかった。
// 起動のときに GET /api/me を読み、200 なら「している」、401 なら「していない」（セッションの Cookie で API が決める。D-027）
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedIn'; account: Account }
  // reason：ログインの画面に出す理由（アカウント停止）。ないときは、理由を出さない（もとからしていない・切れた・ログアウトした）
  | { status: 'signedOut'; reason?: typeof ACCOUNT_SUSPENDED_REASON }
  | { status: 'error' }
