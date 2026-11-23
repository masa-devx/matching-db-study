import type { ReactNode } from 'react'
import { useSession } from '../shared/session/SessionProvider'

// ログインしているかが決まるまで、どの画面も出さずに待つ（ログインの画面が一瞬出て戻るのを防ぐ）。
// 読み込めなかったら、もう一度試すボタンを出す（FR-UI-013）。ログインしているか・していないかの出し分けは、そのあとで App と RequireAuth が決める
type Props = {
  children: ReactNode
}

export const SessionGate = ({ children }: Props) => {
  const { session, retry } = useSession()
  if (session.status === 'loading') {
    return (
      <div className="empty" aria-busy="true">
        <p className="empty-text">読み込み中…</p>
      </div>
    )
  }
  if (session.status === 'error') {
    return (
      <div className="empty" role="alert">
        <p className="empty-text">読み込めませんでした</p>
        <button type="button" className="button" onClick={retry}>
          もう一度
        </button>
      </div>
    )
  }
  return <>{children}</>
}
