import { Notification } from '@mantine/core'
import { type ReactNode, useState } from 'react'

// A6（#208）：操作のあとの知らせ（成功・失敗）。右下に4秒だけ出す。
// 画面ごとに `const [notice, notify] = useNotice()` と書き、`{notice}` を置く（まとめて1か所で持つ仕組みは、作っていない）
export function useNotice(): [ReactNode, (message: string, ok?: boolean) => void] {
  const [state, setState] = useState<{ message: string; ok: boolean } | null>(null)

  const notify = (message: string, ok = true) => {
    setState({ message, ok })
    // 続けて出すと、前のタイマーが新しい知らせを先に消すことがある
    setTimeout(() => setState(null), 4000)
  }

  const node = state && (
    <Notification
      role={state.ok ? 'status' : 'alert'}
      color={state.ok ? 'teal' : 'red'}
      title={state.ok ? '完了' : '失敗'}
      withBorder
      onClose={() => setState(null)}
      style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1000, width: 340 }}
    >
      {state.message}
    </Notification>
  )

  return [node, notify]
}
