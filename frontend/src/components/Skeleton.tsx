// 03c：スケルトン（FR-UI-025）。出てくる中身と同じ大きさの灰色の形を出し、出たときにまわりがずれないようにする

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <ul className="list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="row">
          <span className="skeleton skeleton-circle" />
          <span className="row-body">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line skeleton-short" />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <ul className="user-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="skeleton user-card" />
      ))}
    </ul>
  )
}

export function SkeletonProfile() {
  return (
    <div className="profile" aria-hidden="true">
      <div className="skeleton photo" />
      <span className="skeleton skeleton-line" />
      <span className="skeleton skeleton-block" />
    </div>
  )
}

export function SkeletonTalk() {
  return (
    <ul className="talk-list" aria-hidden="true">
      {[60, 40, 70, 50, 65].map((w, i) => (
        <li key={w} className={i % 2 ? 'bubble bubble-mine' : 'bubble'}>
          <span className="skeleton skeleton-bubble" style={{ width: `${w * 3}px` }} />
        </li>
      ))}
    </ul>
  )
}
