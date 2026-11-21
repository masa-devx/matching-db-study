import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { apiFetch, UnauthorizedError } from '../api/client'
import { clearSession, readToken, saveToken } from './session'

// ログインした自分のアカウント（GET /api/me の一部）。名前は docs/glossary.md の「アカウント」（コードでは Me と呼ばない）
export type Account = {
  id: number
  public_id: string
  email: string
  email_verified_at: string | null
}

// 読み込み中・ログインしている・していない。ログインしているかは、トークンがあるかではなく、GET /api/me が通るかで決める（#257 の 2-2）
export type SessionState = { status: 'loading' } | { status: 'signedIn'; account: Account } | { status: 'signedOut' }

type SessionValue = {
  session: SessionState
  signIn: (token: string) => void
  signOut: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

// 起動のときに1回、GET /api/me を読む。トークンがなければ、API を呼ばずに「していない」にする。
// 401 なら、client.ts が app/ の処理でログインの画面へ読み込み直すので、ここでは何もしない
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() =>
    readToken() ? { status: 'loading' } : { status: 'signedOut' },
  )

  const load = useCallback(async () => {
    if (!readToken()) {
      setSession({ status: 'signedOut' })
      return
    }
    setSession({ status: 'loading' })
    try {
      const res = await apiFetch('/api/me')
      if (!res.ok) {
        // 401 のほか（500 など）は、ログインしていない扱いにして、ログインし直してもらう
        clearSession()
        setSession({ status: 'signedOut' })
        return
      }
      setSession({ status: 'signedIn', account: (await res.json()) as Account })
    } catch (e) {
      if (e instanceof UnauthorizedError) return
      // API が止まっているなど。ログインしていない扱いにする
      setSession({ status: 'signedOut' })
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

  // ログアウト・退会の画面が呼ぶ
  const signOut = useCallback(() => {
    clearSession()
    setSession({ status: 'signedOut' })
  }, [])

  return <SessionContext.Provider value={{ session, signIn, signOut }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession は SessionProvider の中で使う')
  }
  return value
}
