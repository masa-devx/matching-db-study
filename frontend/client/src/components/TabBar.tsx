import { NavLink, useLocation } from 'react-router'
import { messagesTabCount, useBadgeCounts } from '../features/messages'
import Icon from './Icon'

// 03c：下のタブ（SVG のアイコン・すりガラス・選んだタブの点）。メッセージのタブに未読の合計（FR-UI-032）。
// #247：数は、数だけを返す API（GET /api/me/badge-counts）を1本だけ読む（前は、トークの一覧と届いたいいねの一覧を全部読んで数えていた）。
// 読み方（画面を移ったとき・30秒ごと・ウィンドウに戻ったとき）は features/messages の useBadgeCounts
const TABS = [
  { to: '/search', label: '検索', icon: 'search' },
  { to: '/likes', label: 'いいね', icon: 'heart' },
  { to: '/messages', label: 'メッセージ', icon: 'chat' },
  { to: '/home', label: 'ホーム', icon: 'home' },
]

// M9（#198）：ホームの歯車から開く画面。このどれかにいるときは、「ホーム」のタブを選ばれた色にする
// （前は、どのタブも選ばれていない見た目になり、今どこにいるかが分からなかった）。画面を足したら、ここにも足す
const UNDER_HOME = ['/settings', '/info', '/blocks', '/plans', '/likes/sent', '/notices']

export default function TabBar() {
  const location = useLocation()
  const counts = useBadgeCounts(location.pathname)
  // メッセージのタブ：未読の合計と、新しいマッチ（M3。#187）
  const unread = messagesTabCount(counts)
  // いいねのタブ：届いたいいねのうち、まだ返事をしていない人数（M3。#184）
  const received = counts.receivedLikes

  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          viewTransition
          className={({ isActive }) => {
            const underHome = UNDER_HOME.some((p) => location.pathname.startsWith(p))
            // 送ったいいね（/likes/sent）は設定から開くので、「いいね」ではなく「ホーム」を選ばれた色にする
            const on = t.to === '/home' ? isActive || underHome : isActive && !underHome
            return on ? 'tab active' : 'tab'
          }}
        >
          <span className="tab-icon">
            <Icon name={t.icon} />
            {t.to === '/likes' && received > 0 && (
              <span key={received} className="tab-badge">
                {received > 99 ? '99+' : received}
              </span>
            )}
            {t.to === '/messages' && unread > 0 && (
              <span key={unread} className="tab-badge">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
