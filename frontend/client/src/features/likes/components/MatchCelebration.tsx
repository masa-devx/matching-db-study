import { Link } from 'react-router'
import Avatar from '../../../components/Avatar'
import Icon from '../../../components/Icon'
import type { MatchPerson } from '../types'

// マッチの演出（FR-UI-028）。2人の写真が左右から寄り、真ん中にハートがふくらむ。
// 届いたいいねの画面と、相手のプロフィールの画面（まだ移していない。features/likes の index.ts から読む）が使う
type Props = {
  me: MatchPerson | null
  partner: MatchPerson
  // マッチしてできたトークルーム。あれば、「メッセージを送る」で、その相手のトークへ直接移る（FR-UI-069）
  roomId?: string | null
  onClose: () => void
}

export const MatchCelebration = ({ me, partner, roomId, onClose }: Props) => {
  return (
    <div className="match-overlay" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <div className="match-photos">
        <span className="match-left">
          <Avatar image={me?.image} name={me?.nickname} size={112} />
        </span>
        <span className="match-heart">
          <Icon name="heart" size={32} filled />
        </span>
        <span className="match-right">
          <Avatar image={partner.image} name={partner.nickname} size={112} />
        </span>
      </div>
      <p id="match-title" className="match-title">
        マッチしました
      </p>
      <p className="match-text">{partner.nickname}さんも、あなたにいいねしていました</p>
      <Link to={roomId ? `/messages/${roomId}` : '/messages'} viewTransition className="button button-white">
        <span className="button-label">メッセージを送る</span>
      </Link>
      <button type="button" className="match-later" onClick={onClose}>
        あとで
      </button>
    </div>
  )
}
