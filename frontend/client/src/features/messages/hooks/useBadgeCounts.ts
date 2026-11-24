import { useEffect, useEffectEvent } from 'react'
import { create } from 'zustand'
import { StoppedRequestError } from '../../../api/ApiError'
import { messagingApi } from '../../../api/messagingApi'
import { useSession } from '../../../shared/session/SessionProvider'
import { messagesTabCount } from '../rules'
import type { BadgeCounts, TabCounts } from '../types'

// 読み直す間隔（FR-UI-093。前の TabBar と同じ30秒）
const POLL_MS = 30_000

const NO_COUNTS: BadgeCounts = { unreadMessages: 0, newMatches: 0, receivedLikes: 0 }

// 下のタブの数の store（画面をまたぐ数。architecture-frontend.md の5章）。
// ほかの画面（届いたいいね）が書き込みのあとに読み直せるように、TabBar の中の state から、ここに移した。
// store はこのファイルの外に出さない。読むのは useBadgeCounts、書くのは recountBadges と clearBadgeCounts だけ
const useBadgeCountsStore = create<{ counts: BadgeCounts }>()(() => ({ counts: NO_COUNTS }))

// 今読んでいる途中の1本。次を読み始めたら止め、古い応答で新しい数を上書きしない（quality-frontend.md の R4）
let running: AbortController | null = null

// 下のタブの数を、数だけを返す API で1回読み直す。
// TabBar の読み方（画面を移ったとき・30秒ごと・ウィンドウに戻ったとき）のほかに、数が変わる書き込みのあと（スキップ・マッチ・元に戻す）に、その画面の hook が呼ぶ
export const recountBadges = (): void => {
  running?.abort()
  const controller = new AbortController()
  running = controller
  messagingApi
    .badgeCounts(controller.signal)
    .then((next) => {
      // 止めたあとに届いた応答は捨てる。止めても、応答が返ったあとは止まらないため
      if (!controller.signal.aborted) useBadgeCountsStore.setState({ counts: next })
    })
    .catch((error: unknown) => {
      // 止めたとき（次の読み込みを始めた・画面から消えた）は、失敗ではないので黙る
      if (error instanceof DOMException && error.name === 'AbortError') return
      // 401・419・503・確認していない 403 は、client.ts が画面を移す・帯を出すので、記録しない（ログインが切れるたびに記録が増えるだけ）
      if (error instanceof StoppedRequestError) return
      // それ以外（500 などの ApiError・つながらない）は記録し、前の数のまま出す（logging.md の4：空の catch で捨てない）
      reportError(error)
    })
}

// 読むのをやめたら（ログアウトして下のタブが消えた・確認していない会員に戻った）、前の会員の数を消す。
// 消さないと、同じタブで次にログインした会員に、読み終えるまで前の会員の数が出る（前は TabBar の中の state だったので、消えたときに捨てていた）
const clearBadgeCounts = (): void => {
  running?.abort()
  running = null
  useBadgeCountsStore.setState({ counts: NO_COUNTS })
}

// 下のタブに出す数（メッセージのタブ・いいねのタブ）。数だけを返す API を1本だけ読む。
// 読むのは、画面を移ったとき・30秒ごと・ウィンドウに戻ったとき（前の TabBar と同じ）。
// メールアドレスを確認していない会員は、API が 403 で断るので読まない（確認したら、Session が読み直され、読み始める）
export const useBadgeCounts = (pathname: string): TabCounts => {
  const { session } = useSession()
  const canCount = session.status === 'signedIn' && session.account.emailVerified
  const counts = useBadgeCountsStore((state) => state.counts)

  // 30秒ごとと、ウィンドウに戻ったとき。読むのをやめたら、数を消す
  useEffect(() => {
    if (!canCount) return
    const timer = setInterval(recountBadges, POLL_MS)
    window.addEventListener('focus', recountBadges)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', recountBadges)
      clearBadgeCounts()
    }
  }, [canCount])

  // 画面を移ったとき（最初に出たときも）。トークを開いて戻れば、未読が減る。
  // 移った先のパスは数え方に使わないので、出来事の引数として渡す（https://react.dev/learn/separating-events-from-effects）
  const onPageShown = useEffectEvent((_shownPath: string) => recountBadges())
  useEffect(() => {
    if (canCount) onPageShown(pathname)
  }, [canCount, pathname])

  return { messagesTab: messagesTabCount(counts), likesTab: counts.receivedLikes }
}
