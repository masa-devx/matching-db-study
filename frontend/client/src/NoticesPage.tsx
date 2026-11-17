import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Icon from './components/Icon'
import { SkeletonRows } from './components/Skeleton'

// レガシー版（A7。#213）。運営からのお知らせ（/notices）。ホームのベルと、未読があるときの帯から来る。
// 開いたら、まだ読んでいないお知らせを、1件ずつ「読んだ」と送る（まとめて送る API はない）
export default function NoticesPage() {
  const [notices, setNotices] = useState<any[] | null>(null)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const headers = { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` }

  useEffect(() => {
    // ログインが要るかの確かめを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    fetch(`${api}/api/me/notices`, { headers })
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setNotices(list)
        // 画面には「未読」の印を残したまま、API には読んだと送る（次に開いたときは、印が消える）
        for (const n of list) {
          if (!n.read_at) fetch(`${api}/api/me/notices/${n.id}/read`, { method: 'POST', headers })
        }
      })
  }, [])

  return (
    <div>
      <div className="talk-head">
        <button
          type="button"
          className="icon-button"
          aria-label="ホームへ戻る"
          onClick={() => navigate('/home', { viewTransition: true })}
        >
          <Icon name="back" />
        </button>
        <span className="row-name">運営からのお知らせ</span>
      </div>
      {!notices ? (
        <SkeletonRows count={3} />
      ) : notices.length === 0 ? (
        <div className="empty">
          <p className="empty-text">お知らせは、ありません</p>
        </div>
      ) : (
        <ul className="notice-list">
          {notices.map((n) => (
            <li key={n.id} className={n.kind === 'warning' ? 'notice is-warning' : 'notice'}>
              <div className="notice-head">
                <span className="notice-kind">{n.kind === 'warning' ? '注意' : 'お知らせ'}</span>
                {!n.read_at && <span className="notice-new">未読</span>}
                <time className="notice-date">{new Date(n.created_at).toLocaleDateString('ja-JP')}</time>
              </div>
              <h2 className="notice-title">{n.title}</h2>
              <p className="notice-body">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
