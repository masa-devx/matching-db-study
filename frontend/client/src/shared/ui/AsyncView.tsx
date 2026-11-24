import type { ReactNode } from 'react'

// 読み込み中・失敗・中身を出し分ける（FR-UI-013・FR-UI-025）。
// 空のときの出し方は画面ごとに違う（届いたいいねが空でも、スキップした相手の一覧は出す）ので、中身（children）が決める
type Props = {
  status: 'loading' | 'error' | 'success'
  skeleton: ReactNode // 読み込み中に出す、中身と同じ形のスケルトン（形をそろえ、CLS を出さない）
  onRetry: () => void // 失敗したときの「もう一度」
  children: ReactNode
}

export const AsyncView = ({ status, skeleton, onRetry, children }: Props) => {
  if (status === 'loading') return <>{skeleton}</>
  if (status === 'error') {
    return (
      <div className="empty" role="alert">
        <p className="empty-text">読み込めませんでした</p>
        <button type="button" className="button" onClick={onRetry}>
          もう一度
        </button>
      </div>
    )
  }
  return <>{children}</>
}
