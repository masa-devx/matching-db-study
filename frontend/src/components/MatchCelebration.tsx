import { Link } from 'react-router'
import Avatar from './Avatar'
import Icon from './Icon'

// 03c：マッチの演出（FR-UI-028）。2人の写真が左右から寄り、真ん中にハートがふくらむ
type Person = { image?: string | null; nickname?: string | null }

export default function MatchCelebration({
  me,
  partner,
  onClose,
}: {
  me: Person | null
  partner: Person
  onClose: () => void
}) {
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
      <Link to="/messages" viewTransition className="button button-white">
        <span className="button-label">メッセージを送る</span>
      </Link>
      <button type="button" className="match-later" onClick={onClose}>
        あとで
      </button>
    </div>
  )
}
