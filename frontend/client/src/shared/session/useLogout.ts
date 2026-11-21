import { useCallback, useState } from 'react'
import { apiFetchForLogout } from '../api/client'
import { useSession } from './SessionProvider'

// ログアウトの手順（FR-AUTH-016）。ホーム・設定・確認待ちの画面が使う。移る先とトーストは、呼ぶ画面が決める。
// 先にサーバーのセッションを消し、消えたあとでだけ、画面の自分の情報を消す（消えないと Cookie が生きたままで、
// 読み込み直すとログインした状態に戻るため。D-027）。
// 204：ログアウトした。401・419：もうセッションがない（ログアウトしたのと同じ）。ほかの失敗・つながらないは false
export function useLogout(): { logout: () => Promise<boolean>; loggingOut: boolean } {
  const { signOut } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = useCallback(async (): Promise<boolean> => {
    setLoggingOut(true)
    try {
      const res = await apiFetchForLogout('/api/auth/logout', { method: 'POST' })
      if (res.status === 204 || res.status === 401 || res.status === 419) {
        signOut()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setLoggingOut(false)
    }
  }, [signOut])

  return { logout, loggingOut }
}
