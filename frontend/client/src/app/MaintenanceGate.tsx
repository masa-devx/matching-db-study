import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react'
import { isUnderMaintenance, subscribeMaintenance } from './maintenance'

// メンテナンス中なら、どの画面の代わりにも「ただいまメンテナンス中です」を出す（FR-MAINT-006）。
// 画面ごとに 503 を見分けない。ログインの画面にも移さない（ログインもできないため）
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const underMaintenance = useSyncExternalStore(subscribeMaintenance, isUnderMaintenance)
  if (!underMaintenance) return <>{children}</>
  return <MaintenanceScreen />
}

function MaintenanceScreen() {
  const heading = useRef<HTMLHeadingElement>(null)
  // 画面ごと入れ替わるので、押していたボタンが消え、読み上げが何も読まないことがある。見出しにフォーカスを移して読ませる。
  // タブの題も、前の画面のまま残らないようにする（題を変える App が外れるため）
  useEffect(() => {
    document.title = 'メンテナンス中｜matching'
    heading.current?.focus()
  }, [])
  return (
    <div className="empty">
      <h1 ref={heading} className="empty-text" tabIndex={-1}>
        ただいまメンテナンス中です
      </h1>
      <p className="verify-text">しばらくしてから、画面を読み込み直してください。</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>
        読み込み直す
      </button>
    </div>
  )
}
