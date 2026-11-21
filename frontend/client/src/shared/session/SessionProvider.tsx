import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { apiFetchWithoutLogin } from '../api/client'
import { clearSession } from './session'

// GET /api/me の応答の形（レガシー版）。このファイルの外へ出さない（architecture-frontend.md の4章）
type AccountResponse = {
  public_id: string
  email: string
  email_verified_at: string | null
}

// ログインした自分のアカウント（画面の形）。名前は docs/glossary.md の「アカウント」（コードでは Me と呼ばない）
export type Account = {
  userId: string // users.public_id
  email: string
  emailVerified: boolean
}

function toAccount(res: AccountResponse): Account {
  return { userId: res.public_id, email: res.email, emailVerified: res.email_verified_at !== null }
}

// 読み込み中・ログインしている・していない・読み込めなかった。
// 起動のときに GET /api/me を読み、200 なら「している」、401 なら「していない」（セッションの Cookie で API が決める。D-027）
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedIn'; account: Account }
  | { status: 'signedOut' }
  | { status: 'error' }

type SessionValue = {
  session: SessionState
  signIn: () => void
  signOut: () => void
  retry: () => void
}

// 起動のときの GET /api/me を待つ上限。超えたら「読み込めませんでした」にする（FR-UI-013）
const LOAD_TIMEOUT_MS = 10_000

const SessionContext = createContext<SessionValue | null>(null)

// 起動のときに1回、GET /api/me を読む。401（ログインしていない）でも、ログインの画面へは移さない（ログインの画面・登録の画面も、この下にあるため）。
// 401 でない失敗（500・つながらない・時間切れ）では、「読み込めませんでした」にする（API が戻れば、もう一度で戻れる）。
// 503（メンテナンス中）は、client.ts が見分けて、メンテナンスの画面を出す
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })
  // 読み込みが重なったとき（起動の読み込みの途中でログインした）、古い結果で上書きしないための番号
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    setSession({ status: 'loading' })
    try {
      const res = await apiFetchWithoutLogin('/api/me', { signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) })
      if (id !== latest.current) return
      if (res.status === 401) {
        setSession({ status: 'signedOut' })
        return
      }
      if (!res.ok) {
        setSession({ status: 'error' })
        return
      }
      setSession({ status: 'signedIn', account: toAccount((await res.json()) as AccountResponse) })
    } catch {
      if (id !== latest.current) return
      // つながらない・時間切れ
      setSession({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ログインの画面が、ログインの API が通ったあとに呼ぶ。セッションの Cookie はもう付いているので、GET /api/me を読み直す
  const signIn = useCallback(() => {
    load()
  }, [load])

  // ログアウト・退会の画面が呼ぶ。読み込みの途中なら、その結果は捨てる
  const signOut = useCallback(() => {
    latest.current++
    clearSession()
    setSession({ status: 'signedOut' })
  }, [])

  return <SessionContext value={{ session, signIn, signOut, retry: load }}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession は SessionProvider の中で使う')
  }
  return value
}
