// メンテナンス中か（FR-MAINT-006）。client.ts が 503 を受けたら、app/configureApi.ts が enterMaintenance() を呼ぶ。
// 一度入ったら、画面を読み込み直すまで戻らない（解けたかは、会員が読み込み直して確かめる）
let underMaintenance = false
const listeners = new Set<() => void>()

export function enterMaintenance(): void {
  if (underMaintenance) return
  underMaintenance = true
  for (const listener of listeners) listener()
}

// React の useSyncExternalStore に渡す2つ（app/MaintenanceGate.tsx）
export function subscribeMaintenance(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isUnderMaintenance(): boolean {
  return underMaintenance
}
