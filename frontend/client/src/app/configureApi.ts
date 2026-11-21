import { configureApiClient } from '../shared/api/client'
import { clearSession, readToken, SIGNED_OUT_REASON } from '../shared/session/session'

// 起動のときに1回呼ぶ。API にトークンの読み方と、401 のときの動きを渡す。
// 401 なら、ログインした自分の情報を消し、ログインの画面へ移す（画面を読み込み直すので、App が持つトークンの状態も消える）
export function configureApi(): void {
  configureApiClient({
    readToken,
    onUnauthorized: () => {
      clearSession()
      window.location.assign(`/login?reason=${SIGNED_OUT_REASON}`)
    },
  })
}
