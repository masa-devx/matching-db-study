import { useToast } from '../../../components/Toast'
import UpsellDialog from '../../../components/UpsellDialog'
import { LikesView } from '../components/LikesView'
import { MatchCelebration } from '../components/MatchCelebration'
import { useReceivedLikes } from '../hooks/useReceivedLikes'
import type { ReceivedLike, SkippedMember } from '../types'

// いいねのタブ（/likes）＝届いたいいねの画面（FR-UI-064〜067）。
// 取る・送る・持つは useReceivedLikes、見せるのは LikesView。ここは、2つをつなぎ、結果のトーストを出す
export const LikesPage = () => {
  const toast = useToast()
  const received = useReceivedLikes()

  const onMatch = async (like: ReceivedLike): Promise<void> => {
    if ((await received.match(like)) === 'failed') toast('マッチできませんでした', 'error')
  }

  // 'stopped'（ログインが切れた・メンテナンス中など）は、client.ts が画面を移すので、トーストを出さない
  const onSkip = async (like: ReceivedLike): Promise<void> => {
    const outcome = await received.skip(like)
    if (outcome === 'done') toast('スキップしました')
    if (outcome === 'failed') toast('スキップできませんでした', 'error')
  }

  const onRestore = async (skipped: SkippedMember): Promise<void> => {
    const outcome = await received.restore(skipped)
    if (outcome === 'done') toast('元に戻しました')
    if (outcome === 'failed') toast('元に戻せませんでした', 'error')
  }

  return (
    <LikesView
      status={received.status}
      likes={received.likes}
      skips={received.skips}
      busyUserId={received.busyUserId}
      onRetry={received.reload}
      onMatch={onMatch}
      onSkip={onSkip}
      onRestore={onRestore}
    >
      <UpsellDialog open={received.upsellOpen} onClose={received.closeUpsell} />
      {received.celebration !== null && (
        <MatchCelebration
          me={received.celebration.me}
          partner={received.celebration.partner}
          roomId={received.celebration.roomId}
          onClose={received.closeCelebration}
        />
      )}
    </LikesView>
  )
}
