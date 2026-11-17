import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import Icon from './Icon'

// 03c：下のタブ（SVG のアイコン・すりガラス・選んだタブの点）。メッセージのタブに未読の合計（FR-UI-032）。
// 未読は、画面が変わるたびにトークの一覧を全部読んで足す（05 のレガシー版の一覧は 1＋6N 本の SQL なので重い）
const TABS = [
  { to: '/search', label: '検索', icon: 'search' },
  { to: '/likes', label: 'いいね', icon: 'heart' },
  { to: '/messages', label: 'メッセージ', icon: 'chat' },
  { to: '/home', label: 'ホーム', icon: 'home' },
]

// M9（#198）：ホームの歯車から開く画面。このどれかにいるときは、「ホーム」のタブを選ばれた色にする
// （前は、どのタブも選ばれていない見た目になり、今どこにいるかが分からなかった）。画面を足したら、ここにも足す
const UNDER_HOME = ['/settings', '/info', '/blocks', '/plans', '/likes/sent']

export default function TabBar() {
  const [unread, setUnread] = useState(0)
  // M3（#184）：届いたいいねのうち、まだ返事をしていない人数（いいねのタブのバッジ）
  const [received, setReceived] = useState(0)
  const location = useLocation()

  useEffect(() => {
    const count = () => {
      const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
      fetch(`${api}/api/me/talk-rooms`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then((rooms) =>
          // M3（#187）：新しいマッチ（まだ開いていなくて、まだ1通もないルーム）も、1件ずつ数える
          setUnread(
            Array.isArray(rooms)
              ? rooms.reduce(
                  (n: number, r: any) => n + (r.unread_count ?? 0) + (!r.last_message && !r.last_read_at ? 1 : 0),
                  0,
                )
              : 0,
          ),
        )
      // M3：届いたいいねの一覧を全部読んで、件数だけを使う（数だけを返す API はない。画面が変わるたびに読む）
      fetch(`${api}/api/me/received-likes`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then((likes) => setReceived(Array.isArray(likes) ? likes.length : 0))
    }
    count()
    // M9（#198）：同じ画面にいても、30秒ごとと、ウィンドウに戻ったときに数え直す（前は、画面を移るまで数が変わらなかった）。
    // 数だけを返す API はないので、30秒ごとに、トークの一覧（1＋6N 本の SQL）と届いたいいねを全部読む
    const timer = setInterval(count, 30000)
    window.addEventListener('focus', count)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', count)
    }
  }, [location.pathname])

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
