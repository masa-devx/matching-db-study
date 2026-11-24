import Avatar from '../../../components/Avatar'
import { monthDay } from '../../../shared/lib/date'
import { ageLabel, displayName } from '../rules'
import type { SkippedMember } from '../types'

// スキップした相手の一覧（FR-UI-066）。ふだんは閉じておく。元に戻すと、また届いたいいねと検索に出る
type Props = {
  skips: SkippedMember[]
  busyUserId: string | null
  onRestore: (skipped: SkippedMember) => void
}

export const SkippedMembers = ({ skips, busyUserId, onRestore }: Props) => {
  return (
    <details className="likes-skipped">
      <summary>スキップした相手（{skips.length}人）</summary>
      <ul className="list">
        {skips.map((skipped) => (
          <li key={skipped.key} className="row">
            <Avatar image={skipped.image} name={skipped.nickname} />
            <div className="row-body">
              <div className="row-name">
                {displayName(skipped.nickname)} <span className="row-age">{ageLabel(skipped.age)}</span>
              </div>
              <div className="row-sub">{monthDay(skipped.skippedAt)} にスキップ</div>
            </div>
            <button
              type="button"
              className="button button-small button-ghost"
              aria-label={`${displayName(skipped.nickname)}さんのスキップを元に戻す`}
              disabled={busyUserId === skipped.userId}
              onClick={() => onRestore(skipped)}
            >
              元に戻す
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
