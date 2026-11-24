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

  const onSkip = async (like: ReceivedLike): Promise<void> => {
    if (await received.skip(like)) {
      toast('スキップしました')
      return
    }
    toast('スキップできませんでした', 'error')
  }

  const onRestore = async (skipped: SkippedMember): Promise<void> => {
    if (await received.restore(skipped)) {
      toast('元に戻しました')
      return
    }
    toast('元に戻せませんでした', 'error')
  }

  return (
    <LikesView
      likes={received.likes}
      skips={received.skips}
      busyUserId={received.busyUserId}
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
