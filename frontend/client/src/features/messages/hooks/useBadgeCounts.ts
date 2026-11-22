import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useSession } from '../../../shared/session/SessionProvider'
import { fetchBadgeCounts } from '../api'
import type { BadgeCounts } from '../types'

// 読み直す間隔（FR-UI-093。前の TabBar と同じ30秒）
const POLL_MS = 30_000

const NO_COUNTS: BadgeCounts = { unreadMessages: 0, newMatches: 0, receivedLikes: 0 }

// 下のタブのバッジの数（未読・新しいマッチ・届いたいいね）。数だけを返す API を1本だけ読む。
// 読むのは、画面を移ったとき・30秒ごと・ウィンドウに戻ったとき（前の TabBar と同じ）。
// メールアドレスを確認していない会員は、API が 403 で断るので読まない（確認したら、Session が読み直され、読み始める）
export function useBadgeCounts(pathname: string): BadgeCounts {
  const { session } = useSession()
  const canCount = session.status === 'signedIn' && session.account.emailVerified
  const [counts, setCounts] = useState<BadgeCounts>(NO_COUNTS)
  const running = useRef<AbortController | null>(null)

  // 1回読む。前の読み込みが残っていれば止め、古い応答で新しい数を上書きしない（quality-frontend.md の R4）
  const count = useEffectEvent(() => {
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    fetchBadgeCounts(controller.signal)
      .then(setCounts)
      .catch(() => {
        // 止めた・読めなかったときは、前の数のまま出す（401・503 の画面の移り方は client.ts が決める）
      })
  })

  // 30秒ごとと、ウィンドウに戻ったとき
  useEffect(() => {
    if (!canCount) return
    const recount = () => count()
    const timer = setInterval(recount, POLL_MS)
    window.addEventListener('focus', recount)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', recount)
      running.current?.abort()
    }
  }, [canCount])

  // 画面を移ったとき（最初に出たときも）。トークを開いて戻れば、未読が減る。
  // 移った先のパスは数え方に使わないので、出来事の引数として渡す（https://react.dev/learn/separating-events-from-effects）
  const onPageShown = useEffectEvent((_shownPath: string) => count())
  useEffect(() => {
    if (canCount) onPageShown(pathname)
  }, [canCount, pathname])

  return counts
}
