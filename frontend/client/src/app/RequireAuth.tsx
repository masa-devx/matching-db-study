import { Navigate, Outlet } from 'react-router'
import AwaitingVerification from '../components/AwaitingVerification'
import { useSession } from '../shared/session/SessionProvider'

// ログインが要る画面の守り（architecture-frontend.md の4章）。画面ごとにトークンを見ず、ここ1か所で決める。
// 読み込み中と失敗は、外側の SessionGate が出すので、ここに来るのは、ログインしている・していないのどちらか。
// メールアドレスを確認していない会員には、画面の代わりに「確認待ち」を出す（#263。機能の API は 403 なので、画面が止まるため）。
// 開こうとした画面は、まだ覚えない（分かっている不具合：FR-UI-011。ログインのあとは、いつもホームへ移る）
export default function RequireAuth() {
  const { session } = useSession()
  if (session.status !== 'signedIn') return <Navigate to="/login" replace />
  if (!session.account.emailVerified) return <AwaitingVerification email={session.account.email} />
  return <Outlet />
}
