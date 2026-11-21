import { configureApiClient } from '../shared/api/client'
import { ACCOUNT_SUSPENDED_REASON, clearSession, readToken, SIGNED_OUT_REASON } from '../shared/session/session'

// 401 が同時に何本も届いても、移るのは1回だけにする（タブのバーや帯も、同じときに API を呼んでいるため）
let leaving = false

// 起動のときに1回呼ぶ。API にトークンの読み方と、401 のときの動きを渡す（architecture-frontend.md の4章）。
// 401 なら、ログインした自分の情報を消し、理由を付けてログインの画面へ移す（画面を読み込み直すので、App が持つトークンの状態も、ポーリングも止まる）。
// RequireAuth（#257 の 2-2）を作ったら、移すのはそちらに任せ、ここは消すだけにする
export function configureApi(): void {
  configureApiClient({
    readToken,
    onUnauthorized: (code) => {
      if (leaving) return
      leaving = true
      clearSession()
      const reason = code === 'account_suspended' ? ACCOUNT_SUSPENDED_REASON : SIGNED_OUT_REASON
      window.location.assign(`/login?reason=${reason}`)
    },
  })
}
