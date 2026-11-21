import { Navigate, Outlet } from 'react-router'
import { useSession } from '../shared/session/SessionProvider'

// ログインが要る画面の守り（architecture-frontend.md の4章）。画面ごとにトークンを見ず、ここ1か所で決める。
// 読み込み中と失敗は、外側の SessionGate が出すので、ここに来るのは、ログインしている・していないのどちらか。
// 開こうとした画面は、まだ覚えない（分かっている不具合：FR-UI-011。ログインのあとは、いつもホームへ移る）
export default function RequireAuth() {
  const { session } = useSession()
  if (session.status !== 'signedIn') return <Navigate to="/login" replace />
  return <Outlet />
}
