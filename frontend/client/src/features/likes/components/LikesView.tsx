import type { ReactNode } from 'react'
import { Link } from 'react-router'
import Avatar from '../../../components/Avatar'
import Button from '../../../components/Button'
import EmptyState from '../../../components/EmptyState'
import { SkeletonRows } from '../../../components/Skeleton'
import { monthDay } from '../../../shared/lib/date'
import { AsyncView } from '../../../shared/ui/AsyncView'
import { ageLabel, displayName } from '../rules'
import type { ReceivedLike, SkippedMember } from '../types'
import { SkippedMembers } from './SkippedMembers'

// 届いたいいねの画面の中身（FR-UI-064〜067）。届いたいいねの一覧と、その下に、スキップした相手の一覧を出す
type Props = {
  status: 'loading' | 'error' | 'success'
  likes: ReceivedLike[]
  skips: SkippedMember[]
  busyUserId: string | null
  onRetry: () => void
  onMatch: (like: ReceivedLike) => void
  onSkip: (like: ReceivedLike) => void
  onRestore: (skipped: SkippedMember) => void
  children?: ReactNode // 画面に重ねるもの（誘導のモーダル・マッチの演出）。container が渡す
}

export const LikesView = ({
  status,
  likes,
  skips,
  busyUserId,
  onRetry,
  onMatch,
  onSkip,
  onRestore,
  children,
}: Props) => {
  // 読み込み中は、行と同じ形のスケルトン（FR-UI-025）。失敗したら「読み込めませんでした」と「もう一度」（FR-UI-013）
  return (
    <AsyncView status={status} skeleton={<SkeletonRows />} onRetry={onRetry}>
      <div>
        <h1 className="page-title">いいね</h1>
        <p className="likes-lead">
          あなたにいいねした人です。「マッチする」でメッセージを送れるようになります。スキップしても、相手には伝わりません。
        </p>
        {/* 空のときは、次にやることを1つ出す（FR-UI-033） */}
        {likes.length === 0 && (
          <EmptyState icon="heart" text="まだ、いいねは届いていません" actionLabel="検索で相手を探す" to="/search" />
        )}
        <ul className="likes-list">
          {likes.map((like) => (
            <ReceivedLikeCard
              key={like.userId}
              like={like}
              busy={busyUserId === like.userId}
              onMatch={onMatch}
              onSkip={onSkip}
            />
          ))}
        </ul>

        {skips.length > 0 && <SkippedMembers skips={skips} busyUserId={busyUserId} onRestore={onRestore} />}

        {children}
      </div>
    </AsyncView>
  )
}

type ReceivedLikeCardProps = {
  like: ReceivedLike
  busy: boolean // 送っている間。ボタンを押せなくする
  onMatch: (like: ReceivedLike) => void
  onSkip: (like: ReceivedLike) => void
}

// 届いたいいねの1人。相手を押すとプロフィールへ移る
const ReceivedLikeCard = ({ like, busy, onMatch, onSkip }: ReceivedLikeCardProps) => {
  return (
    <li className="card likes-card">
      <Link to={`/users/${like.userId}`} viewTransition className="likes-person">
        <Avatar image={like.image} name={like.nickname} />
        <div className="row-body">
          <div className="row-name">
            {displayName(like.nickname)} <span className="row-age">{ageLabel(like.age)}</span>
          </div>
          <div className="row-sub">
            {like.prefecture ?? ''} {monthDay(like.likedAt)} にいいね
          </div>
        </div>
      </Link>
      <div className="likes-actions">
        <Button variant="ghost" disabled={busy} onClick={() => onSkip(like)}>
          スキップ
        </Button>
        <Button loading={busy} onClick={() => onMatch(like)}>
          マッチする
        </Button>
      </div>
    </li>
  )
}
