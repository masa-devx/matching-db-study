import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import EmptyState from './components/EmptyState'
import { SkeletonRows } from './components/Skeleton'

// レガシー版（05）。メッセージのタブ（/messages）＝トークの一覧。相手ごとに最新の1件と未読の数を出し、押すとトーク画面に移る。
// M3（#187）：上に「新しいマッチ」を分けた。
// M6（#190）：いいねのタブ（箱を並べる形）と見分けが付くよう、チャットの一覧の形（平らな行・未読は太字と数）に作り直した。
// 名前でさがす・未読だけ・10秒ごとの読み直しも、ここに足した。取る・絞る・見せるを、全部この部品に書く
export default function MessagesPage() {
  const [rooms, setRooms] = useState<any[] | null>(null)
  const [keyword, setKeyword] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const navigate = useNavigate()

  // 読み込み中・失敗は考えない。API が 500 を返すと、画面は空のまま（rooms が配列でないので filter で落ちる）
  const load = () => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/talk-rooms`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setRooms)
  }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    load()
    // M6：開いたままでも新しいメッセージに気づけるよう、10秒ごとに一覧を全部読み直す（一覧の API は、ルームごとに6本の SQL が流れる）
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [])

  // M6：今日は時刻、昨日は「昨日」、今年は月日、それより前は年も出す。日付の比べ方を、トーク画面とは別に、ここにも書いた
  const when = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((day(now) - day(d)) / 86400000)
    if (diff === 0) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    if (diff === 1) return '昨日'
    if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  // 03c：読み込み中は、行と同じ形のスケルトン（FR-UI-025）
  if (!rooms) return <SkeletonRows />

  // M3（#187）：新しいマッチ＝まだ一度も開いていなくて（last_read_at が null）、まだ1通もないルーム。
  // 上に写真を横に並べて見せ、下の一覧からは外す（やり取り中の相手と混ざると、最初の一通を送りそびれる）
  const fresh = rooms.filter((r) => !r.last_message && !r.last_read_at)
  const talking = rooms.filter((r) => r.last_message || r.last_read_at)
  // M6：名前と「未読だけ」で絞る（画面が持っている一覧を絞るだけ。API には送らない）
  const shown = talking.filter(
    (r) => (r.nickname ?? '').includes(keyword.trim()) && (!unreadOnly || r.unread_count > 0),
  )

  return (
    <div>
      <h1 className="page-title">メッセージ</h1>
      {/* 03c：空のときは、次にやることを1つ出す（FR-UI-033） */}
      {rooms.length === 0 && (
        <EmptyState icon="chat" text="まだマッチした相手はいません" actionLabel="検索で相手を探す" to="/search" />
      )}
      {fresh.length > 0 && (
        <section className="new-matches" aria-labelledby="new-matches-title">
          <h2 className="section-title" id="new-matches-title">
            新しいマッチ <span className="new-count">{fresh.length}</span>
          </h2>
          <p className="likes-lead">マッチしたばかりの相手です。最初のメッセージを送ってみましょう。</p>
          <ul className="new-list">
            {fresh.map((r) => (
              <li key={r.room_id}>
                <Link to={`/messages/${r.room_id}`} viewTransition className="new-item">
                  <Avatar image={r.image} name={r.nickname} size={64} />
                  <span className="new-name">{r.nickname ?? '退会した会員'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {talking.length > 0 && (
        <>
          {fresh.length > 0 && <h2 className="section-title">やり取り</h2>}
          {/* M6：名前でさがす・未読だけ */}
          <div className="chat-tools">
            <input
              className="input chat-search"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名前でさがす"
              aria-label="名前でさがす"
            />
            <button
              type="button"
              className={unreadOnly ? 'chip chip-on chat-filter' : 'chip chat-filter'}
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly(!unreadOnly)}
            >
              未読だけ
            </button>
          </div>
          {shown.length === 0 && <p className="soon">当てはまる相手がいません</p>}
          <ul className="chat-list">
            {shown.map((r) => (
              <li key={r.room_id}>
                <Link
                  to={`/messages/${r.room_id}`}
                  viewTransition
                  className={r.unread_count > 0 ? 'chat-row is-unread' : 'chat-row'}
                >
                  <Avatar image={r.image} name={r.nickname} size={56} />
                  <div className="chat-body">
                    <div className="chat-top">
                      <span className="chat-name">
                        {r.nickname ?? '退会した会員'} {/* 年齢の計算を、また写した（誕生日の前だと1歳多い） */}
                        {r.birthday && (
                          <span className="row-age">
                            {new Date().getFullYear() - Number(r.birthday.slice(0, 4))}歳
                          </span>
                        )}
                      </span>
                      <span className="chat-time">{when(r.last_message?.created_at ?? r.created_at)}</span>
                    </div>
                    <div className="chat-bottom">
                      <span className="chat-preview">
                        {/* M6：自分が送った最後の1件には「あなた：」を付ける（返事を待っている相手だと分かる） */}
                        {r.last_message
                          ? `${r.last_message.mine ? 'あなた：' : ''}${r.last_message.body}`
                          : 'メッセージを送ってみましょう'}
                      </span>
                      {r.unread_count > 0 && (
                        <span className="chat-unread" aria-label={`未読 ${r.unread_count}件`}>
                          {r.unread_count > 99 ? '99+' : r.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 05c：同じやり取りを Firestore（手元の Emulator）で見る画面へ（学習用。M6 で、いちばん下に移した） */}
      <Link to="/messages-fs" className="chat-fs-link">
        Firestore 版で見る（学習用）
      </Link>
    </div>
  )
}
