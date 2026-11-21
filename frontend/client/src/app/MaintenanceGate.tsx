import { type ReactNode, useSyncExternalStore } from 'react'
import { isUnderMaintenance, subscribeMaintenance } from './maintenance'

// メンテナンス中なら、どの画面の代わりにも「ただいまメンテナンス中です」を出す（FR-MAINT-006）。
// 画面ごとに 503 を見分けない。ログインの画面にも移さない（ログインもできないため）
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const underMaintenance = useSyncExternalStore(subscribeMaintenance, isUnderMaintenance)
  if (!underMaintenance) return <>{children}</>
  return (
    <div className="empty" role="status">
      <p className="empty-text">ただいまメンテナンス中です</p>
      <p className="verify-text">しばらくしてから、画面を読み込み直してください。</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>
        読み込み直す
      </button>
    </div>
  )
}
