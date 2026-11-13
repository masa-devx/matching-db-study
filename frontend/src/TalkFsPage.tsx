import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { countReads, db, signInFirebase } from './firebase'
import ReadCounter from './ReadCounter'

// レガシー版（05c）。Firestore 版のトーク画面（/messages-fs/:roomId）。05 の TalkPage を写して、取り方を Firestore に変えた。
// limit のないリスナーで、ルームのメッセージを全部聞く（開くたびに全部読む）。時刻は画面の時計で入れる
export default function TalkFsPage() {
  const { roomId } = useParams()
  const [uid, setUid] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [partner, setPartner] = useState<any>(null)
  const [body, setBody] = useState('')
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    let stop = () => {}
    signInFirebase().then(async (me) => {
      setUid(me)
      // 相手を知るために、自分の受信箱のこのルームを読み、名前は Laravel（PostgreSQL）から読む
      const inbox = await getDoc(doc(db, 'users', me, 'rooms', roomId!))
      countReads(1)
      fetch(`${api}/api/users/${inbox.data()?.partnerUid}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then(setPartner)
      // limit なし：最初に全部が届き、あとは変わったものが届く
      stop = onSnapshot(query(collection(db, 'rooms', roomId!, 'messages'), orderBy('createdAt')), (snap) => {
        // 送ったばかりの自分のもの（まだサーバーに届いていない）は、手元の SDK が先に出すだけなので数えない
        if (!snap.metadata.hasPendingWrites) countReads(snap.docChanges().length)
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        // 届くたびに、いちばん下を見せる（少し待ってから動かす）
        setTimeout(() => {
          const box = document.querySelector('.frame-main')
          if (box) box.scrollTop = box.scrollHeight
        }, 100)
      })
      // 開いたら読んだことにする（画面の時計）
      updateDoc(doc(db, 'users', me, 'rooms', roomId!), { lastReadAt: new Date() })
    })
    return () => stop()
  }, [roomId])

  const send = (e: any) => {
    e.preventDefault()
    // 入力を確かめない（ゆるいルールなので、空でも入る）。受信箱は直さない
    addDoc(collection(db, 'rooms', roomId!, 'messages'), { senderId: uid, body, createdAt: new Date() })
    setBody('')
  }

  return (
    <div className="talk">
      <div className="talk-head">
        <button className="button button-small button-ghost" onClick={() => navigate('/messages-fs')}>
          ←
        </button>
        {partner?.profile?.image && <img className="row-avatar" src={`${api}${partner.profile.image}`} />}
        <span className="row-name">{partner?.profile?.nickname ?? ''}</span>
      </div>
      <ReadCounter />

      <ul className="talk-list">
        {messages.map((m) => (
          <li key={m.id} className={m.senderId === uid ? 'bubble bubble-mine' : 'bubble'}>
            <span className="bubble-body">{m.body}</span>
            <span className="bubble-time">
              {m.createdAt?.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>

      <form className="talk-form" onSubmit={send}>
        <input
          className="input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="メッセージを入力"
        />
        <button className="button button-small">送る</button>
      </form>
    </div>
  )
}
