import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { apiFetch, UnauthorizedError } from '../api/client'
import { clearSession, readToken, saveToken } from './session'

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
// トークンがなければ API を呼ばずに「していない」。あれば、GET /api/me が通るかで決める（#257 の 2-2）
export type SessionState =
  | { status: 'loading' }
  | { status: 'signedIn'; account: Account }
  | { status: 'signedOut' }
  | { status: 'error' }

type SessionValue = {
  session: SessionState
  signIn: (token: string) => void
  signOut: () => void
  retry: () => void
}

// 起動のときの GET /api/me を待つ上限。超えたら「読み込めませんでした」にする（FR-UI-013）
const LOAD_TIMEOUT_MS = 10_000

const SessionContext = createContext<SessionValue | null>(null)

// 起動のときに1回、GET /api/me を読む。
// 401 なら、client.ts が app/ の処理でトークンを消してログインの画面へ読み込み直すので、ここでは何もしない。
// 401 でない失敗（500・つながらない・時間切れ）では、トークンを消さない（API が戻れば、もう一度で戻れる）
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() =>
    readToken() ? { status: 'loading' } : { status: 'signedOut' },
  )
  // 読み込みが重なったとき（起動の読み込みの途中でログインした）、古い結果で上書きしないための番号
  const latest = useRef(0)

  const load = useCallback(async () => {
    const id = ++latest.current
    if (!readToken()) {
      setSession({ status: 'signedOut' })
      return
    }
    setSession({ status: 'loading' })
    try {
      const res = await apiFetch('/api/me', { signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) })
      if (id !== latest.current) return
      if (!res.ok) {
        setSession({ status: 'error' })
        return
      }
      setSession({ status: 'signedIn', account: toAccount((await res.json()) as AccountResponse) })
    } catch (e) {
      if (id !== latest.current || e instanceof UnauthorizedError) return
      // つながらない・時間切れ
      setSession({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ログインの画面が呼ぶ。トークンを置いて、もう一度 GET /api/me を読む
  const signIn = useCallback(
    (token: string) => {
      saveToken(token)
      load()
    },
    [load],
  )

  // ログアウト・退会の画面が呼ぶ。読み込みの途中なら、その結果は捨てる
  const signOut = useCallback(() => {
    latest.current++
    clearSession()
    setSession({ status: 'signedOut' })
  }, [])

  return <SessionContext.Provider value={{ session, signIn, signOut, retry: load }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession は SessionProvider の中で使う')
  }
  return value
}
