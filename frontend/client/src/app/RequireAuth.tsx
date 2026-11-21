import { Navigate, Outlet } from 'react-router'
import { useSession } from '../shared/session/SessionProvider'

// ログインが要る画面の守り（architecture-frontend.md の4章）。画面ごとにトークンを見ず、ここ1か所で決める。
// 読み込み中は何も出さない（ログインの画面が一瞬出て、また戻るのを防ぐ）
export default function RequireAuth() {
  const { session } = useSession()
  if (session.status === 'loading') return null
  if (session.status === 'signedOut') return <Navigate to="/login" replace />
  return <Outlet />
}
