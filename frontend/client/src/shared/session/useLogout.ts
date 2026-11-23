import { useCallback, useState } from 'react'
import { ApiError } from '../../api/ApiError'
import { authApi } from '../../api/authApi'
import { useSession } from './SessionProvider'

// ログアウトの手順（FR-AUTH-016）。ホーム・設定・確認待ちの画面が使う。移る先とトーストは、呼ぶ画面が決める。
// 先にサーバーのセッションを消し、消えたあとでだけ、画面の自分の情報を消す（消えないと Cookie が生きたままで、
// 読み込み直すとログインした状態に戻るため。D-027）。
// 2xx（204）：ログアウトした。401・419：もうセッションがない（ログアウトしたのと同じ）。ほかの失敗・つながらないは false
export const useLogout = (): { logout: () => Promise<boolean>; loggingOut: boolean } => {
  const { signOut } = useSession()
  const [loggingOut, setLoggingOut] = useState<boolean>(false)

  const logout = useCallback(async (): Promise<boolean> => {
    setLoggingOut(true)
    try {
      await authApi.logout()
      signOut()
      return true
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 419)) {
        signOut()
        return true
      }
      return false
    } finally {
      setLoggingOut(false)
    }
  }, [signOut])

  return { logout, loggingOut }
}
