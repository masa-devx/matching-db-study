import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/ApiError'
import { profileApi } from '../../api/profileApi'
import { ACCOUNT_SUSPENDED_REASON, clearSession } from './session'

// ログインした自分のアカウント（画面の形）。名前は docs/glossary.md の「アカウント」（コードでは Me と呼ばない）。
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

type SessionValue = {
  session: SessionState
  // ログインの API が通ったあとに呼ぶ。GET /api/me が通れば true（Cookie が届いていない設定なら false）
  signIn: () => Promise<boolean>
  signOut: () => void
  retry: () => void
}

// 起動のときの GET /api/me を待つ上限。超えたら「読み込めませんでした」にする（FR-UI-013）
const LOAD_TIMEOUT_MS = 10_000

const SessionContext = createContext<SessionValue | null>(null)

// 起動のときに1回、GET /api/me を読む。401（ログインしていない）でも、ログインの画面へは移さない（ログインの画面・登録の画面も、この下にあるため）。
// 401 のときは、前の会員の画面の情報（前の検索の条件・前の JWT）を消し、アカウント停止なら理由を持つ（ログインの画面へ移すのは RequireAuth）。
// 401 でない失敗（500・つながらない・時間切れ）では、「読み込めませんでした」にする（API が戻れば、もう一度で戻れる）。
// 503（メンテナンス中）は、client.ts が見分けて、メンテナンスの画面を出す。
// Cookie はタブのあいだで共有する。タブを開き直したときに読み直し、ほかのタブで別の会員がログインしていたら、画面を読み込み直す（onAccountChanged）
type Props = {
  children: ReactNode
  onAccountChanged?: () => void
}

export const SessionProvider = ({ children, onAccountChanged = () => window.location.reload() }: Props) => {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })
  // 読み込みが重なったとき（起動の読み込みの途中でログインした）、古い結果で上書きしないための番号
  const latest = useRef(0)
  // タブを開き直したときに、今の会員と比べるため
  const current = useRef<SessionState>(session)
  useEffect(() => {
    current.current = session
  }, [session])

  const signedOut = useCallback((code: string | null) => {
    clearSession()
    setSession(
      code === 'account_suspended'
        ? { status: 'signedOut', reason: ACCOUNT_SUSPENDED_REASON }
        : { status: 'signedOut' },
    )
  }, [])

  const load = useCallback(async (): Promise<boolean> => {
    const id = ++latest.current
    setSession({ status: 'loading' })
    try {
      const account = await profileApi.account(AbortSignal.timeout(LOAD_TIMEOUT_MS))
      if (id !== latest.current) return false
      setSession({ status: 'signedIn', account })
      return true
    } catch (e) {
      if (id !== latest.current) return false
      if (e instanceof ApiError && e.status === 401) {
        signedOut(e.code)
        return false
      }
      // 401 でない失敗（500・503）・つながらない・時間切れ
      setSession({ status: 'error' })
      return false
    }
  }, [signedOut])

  useEffect(() => {
    load()
  }, [load])

  // タブを開き直したとき（visibilitychange）に読み直す。読み込み中の表示は出さない（タブを替えるたびにちらつかないように）
  useEffect(() => {
    const recheck = async () => {
      const before = current.current
      if (document.visibilityState !== 'visible' || before.status !== 'signedIn') return
      try {
        const account = await profileApi.account()
        if (account.userId !== before.account.userId) {
          onAccountChanged()
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          latest.current++
          signedOut(e.code)
        }
        // ほかの失敗・つながらないときは、今の画面のまま（次の API の失敗で扱う）
      }
    }
    document.addEventListener('visibilitychange', recheck)
    return () => document.removeEventListener('visibilitychange', recheck)
  }, [signedOut, onAccountChanged])

  // ログインの画面が、ログインの API が通ったあとに呼ぶ。セッションの Cookie はもう付いているので、GET /api/me を読み直す
  const signIn = useCallback(() => load(), [load])

  // ログアウト・退会の画面が呼ぶ。読み込みの途中なら、その結果は捨てる
  const signOut = useCallback(() => {
    latest.current++
    clearSession()
    setSession({ status: 'signedOut' })
  }, [])

  return <SessionContext value={{ session, signIn, signOut, retry: load }}>{children}</SessionContext>
}

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession は SessionProvider の中で使う')
  }
  return value
}
