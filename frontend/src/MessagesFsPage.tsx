import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { countReads, db, signInFirebase } from './firebase'
import ReadCounter from './ReadCounter'

// レガシー版（05c）。Firestore 版のトークの一覧（/messages-fs）。05 の MessagesPage を写して、取り方だけを Firestore に変えた。
// 受信箱には必要な情報（partnerUid・lastReadAt）しかないので、ルームごとに最新の1件・未読・相手の名前を読みに行く（N+1）
export default function MessagesFsPage() {
  const [rooms, setRooms] = useState<any[] | null>(null)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない
    signInFirebase().then(async (uid) => {
      // 自分の受信箱を全部読む（limit なし。並べる時刻がないので、Firestore では並べられない）
      const inbox = await getDocs(collection(db, 'users', uid, 'rooms'))
      countReads(Math.max(inbox.size, 1))
      const rows = await Promise.all(
        inbox.docs.map(async (r) => {
          const msgs = collection(db, 'rooms', r.id, 'messages')
          // 最新の1件（0件でも1件分の読み取り）
          const last = await getDocs(query(msgs, orderBy('createdAt', 'desc'), limit(1)))
          countReads(Math.max(last.size, 1))
          // 未読：最後に開いた時刻より新しいものを全部読んで、画面で相手のものを数える（まだ開いていなければ全部）
          const after = await getDocs(query(msgs, where('createdAt', '>', r.data().lastReadAt ?? new Date(0))))
          countReads(Math.max(after.size, 1))
          const unread = after.docs.filter((m) => m.data().senderId !== uid).length
          // 相手の名前と写真は、Firestore にないので、ルームごとに Laravel（PostgreSQL）から読む
          const partner = await fetch(`${api}/api/users/${r.data().partnerUid}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
          }).then((x) => x.json())
          return { id: r.id, last: last.docs[0]?.data(), unread, partner }
        }),
      )
      // 並べるのは画面（最新のメッセージの時刻。やり取りのないルームは最後）
      rows.sort((a, b) => (b.last?.createdAt?.toMillis() ?? 0) - (a.last?.createdAt?.toMillis() ?? 0))
      setRooms(rows)
    })
  }, [])

  if (!rooms) return <ReadCounter />

  return (
    <div>
      <h1 className="page-title">メッセージ（Firestore 版）</h1>
      <ReadCounter />
      {rooms.length === 0 && <p className="soon">まだマッチした相手はいません</p>}
      <ul className="list">
        {rooms.map((r) => (
          <li key={r.id}>
            <Link to={`/messages-fs/${r.id}`} className="row">
              {r.partner?.profile?.image ? (
                <img className="row-avatar" src={`${api}${r.partner.profile.image}`} />
              ) : (
                <div className="row-avatar me-avatar-empty">?</div>
              )}
              <div className="row-body">
                <div className="row-name">{r.partner?.profile?.nickname ?? '退会した会員'}</div>
                <div className="row-sub">{r.last ? r.last.body : 'メッセージを送ってみましょう'}</div>
              </div>
              <div className="row-side">
                {r.last && (
                  <span className="row-date">
                    {r.last.createdAt.toDate().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </span>
                )}
                {r.unread > 0 && <span className="badge">{r.unread}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
