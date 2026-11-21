import { configureApiClient } from '../shared/api/client'
import { ACCOUNT_SUSPENDED_REASON, clearSession, readToken, SIGNED_OUT_REASON } from '../shared/session/session'
import { enterMaintenance, isUnderMaintenance } from './maintenance'

// 401 が同時に何本も届いても、移るのは1回だけにする（タブのバーや帯も、同じときに API を呼んでいるため）
let leaving = false

// 起動のときに1回呼ぶ。API にトークンの読み方と、401 のときの動きを渡す（architecture-frontend.md の4章）。
// 401 なら、ログインした自分の情報を消し、理由を付けてログインの画面へ移す（画面を読み込み直すので、SessionProvider の状態も、ポーリングも消える）。
// ログアウト・退会は SessionProvider の signOut() で消すので、消す入口が2つある。読み込み直しをやめるときに、
// SessionProvider が configureApiClient() に 401 の処理を渡す形にして、1つにする（docs/cycles/01-backend-foundation/05-problems.md の #257）
// moveTo はテストのために受け取る（jsdom は読み込み直しを動かせないため）。ふだんは渡さない
export function configureApi(moveTo: (url: string) => void = (url) => window.location.assign(url)): void {
  configureApiClient({
    readToken,
    onUnauthorized: (code) => {
      // メンテナンスに入ったあとに、前に送った要求の 401 が届いても、ログインの画面へは移さない（FR-MAINT-006）
      if (leaving || isUnderMaintenance()) return
      leaving = true
      clearSession()
      const reason = code === 'account_suspended' ? ACCOUNT_SUSPENDED_REASON : SIGNED_OUT_REASON
      moveTo(`/login?reason=${reason}`)
    },
    // 503（メンテナンス中）は、トークンを消さず、ログインの画面にも移さない。画面の代わりにメンテナンスの画面を出す
    onMaintenance: enterMaintenance,
  })
}
