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

export default function TabBar() {
  const [unread, setUnread] = useState(0)
  const location = useLocation()

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
    fetch(`${api}/api/me/talk-rooms`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then((rooms) =>
        setUnread(Array.isArray(rooms) ? rooms.reduce((n: number, r: any) => n + (r.unread_count ?? 0), 0) : 0),
      )
  }, [location.pathname])

  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} viewTransition className="tab">
          <span className="tab-icon">
            <Icon name={t.icon} />
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
