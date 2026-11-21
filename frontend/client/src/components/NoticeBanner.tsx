import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { apiFetch } from '../shared/api/client'

// A7（#213）：運営からのお知らせに、まだ読んでいないものがあるとき、どの画面にも帯を出す。
// 画面が変わるたびに、お知らせの一覧を全部読んで、未読の数を数える（数だけを返す API はない。
// 未確認の帯・タブのバッジとは別に、ここでももう1本呼ぶ）
export default function NoticeBanner() {
  const [unread, setUnread] = useState(0)
  const [warning, setWarning] = useState(false)
  const location = useLocation()

  useEffect(() => {
    apiFetch(`/api/me/notices`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows.filter((n: any) => !n.read_at) : []
        setUnread(list.length)
        setWarning(list.some((n: any) => n.kind === 'warning'))
      })
  }, [location.pathname])

  // お知らせの画面にいるあいだは、出さない
  if (unread === 0 || location.pathname === '/notices') return null

  return (
    <div className={warning ? 'verify-banner notice-banner is-warning' : 'verify-banner notice-banner'} role="status">
      <p>
        {warning ? '運営から、注意のお知らせが届いています。' : '運営から、お知らせが届いています。'}（{unread}件）
      </p>
      <Link className="button button-small button-ghost" to="/notices">
        読む
      </Link>
    </div>
  )
}
