import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import EmptyState from './components/EmptyState'
import { SkeletonRows } from './components/Skeleton'

// レガシー版（05）。メッセージのタブ（/messages）＝トークの一覧。相手ごとに最新の1件と未読の数を出し、押すとトーク画面に移る。
// 03b の「マッチした相手の一覧」を、そのまま書き換えた（取る・見せるを、全部この部品に書く）
export default function MessagesPage() {
  const [rooms, setRooms] = useState<any[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない。API が 500 を返すと、画面は空のまま（rooms が配列でないので map で落ちる）
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/talk-rooms`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setRooms)
  }, [])

  // 03c：読み込み中は、行と同じ形のスケルトン（FR-UI-025）
  if (!rooms) return <SkeletonRows />

  return (
    <div>
      <h1 className="page-title">メッセージ</h1>
      {/* 05c：同じやり取りを Firestore（手元の Emulator）で見る画面へ */}
      <Link to="/messages-fs" className="button button-small button-ghost fs-link">
        Firestore 版で見る
      </Link>
      {/* 03c：空のときは、次にやることを1つ出す（FR-UI-033） */}
      {rooms.length === 0 && (
        <EmptyState icon="chat" text="まだマッチした相手はいません" actionLabel="検索で相手を探す" to="/search" />
      )}
      <ul className="list">
        {rooms.map((r) => (
          <li key={r.room_id}>
            <Link to={`/messages/${r.room_id}`} viewTransition className="row">
              <Avatar image={r.image} name={r.nickname} />
              <div className="row-body">
                <div className="row-name">
                  {r.nickname ?? '退会した会員'} {/* 年齢の計算を、また写した（誕生日の前だと1歳多い） */}
                  {r.birthday && (
                    <span className="row-age">{new Date().getFullYear() - Number(r.birthday.slice(0, 4))}歳</span>
                  )}
                </div>
                <div className="row-sub">{r.last_message ? r.last_message.body : 'メッセージを送ってみましょう'}</div>
              </div>
              <div className="row-side">
                <span className="row-date">
                  {new Date(r.last_message?.created_at ?? r.created_at).toLocaleDateString('ja-JP', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </span>
                {r.unread_count > 0 && <span className="badge">{r.unread_count > 99 ? '99+' : r.unread_count}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
