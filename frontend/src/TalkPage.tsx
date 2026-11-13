import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

// レガシー版（05）。トーク画面（/messages/:roomId）。取る・続き・5秒ごとの読み直し・送る・見せるを、全部この部品に書く。
export default function TalkPage() {
  const { roomId } = useParams()
  const [messages, setMessages] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [done, setDone] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [partner, setPartner] = useState<any>(null)
  const [body, setBody] = useState('')
  // 06：ブロックの確かめのモーダルを開いているか
  const [confirming, setConfirming] = useState(false)
  // 07：自分の性別（/api/me には出ないので、プロフィールをもう1回読む）と、誘導のモーダル
  const [myGender, setMyGender] = useState('')
  const [upsell, setUpsell] = useState(false)
  const navigate = useNavigate()

  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const headers = { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` }

  // 1ページ（新しい50件）を取る。1ページ目は今の一覧と入れ替え、2ページ目からは上に足す
  const load = (p: number) => {
    fetch(`${api}/api/me/talk-rooms/${roomId}/messages?page=${p}`, { headers })
      .then((r) => r.json())
      .then((rows) => {
        // API は新しい順で返すので、逆にして古い順にする
        const old = [...rows].reverse()
        // 1ページ目は入れ替える（5秒ごとの読み直しでも入れ替えるので、上にさかのぼって読んだものが消える）
        // 2ページ目からは、このときの messages の前に足す（読み直しと重なると、古い messages に足してしまう）
        setMessages(p === 1 ? old : [...old, ...messages])
        setPage(p)
        // 50件より少なければ、もう古いものはない
        setDone(rows.length < 50)
      })
  }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 自分のメッセージかを見分けるために、自分の id を読む（ホームでも読んでいるが、もう一度読む）
    fetch(`${api}/api/me`, { headers })
      .then((r) => r.json())
      .then((u) => {
        setMe(u)
        // 07：性別を知るために、自分のプロフィールを読む（ホームと同じ2本を、ここにも写す）
        return fetch(`${api}/api/users/${u.public_id}`, { headers })
      })
      .then((r) => r.json())
      .then((u) => setMyGender(u.profile?.gender ?? ''))
    // 相手の名前と写真を出すために、トークの一覧を全部読んで、このルームを探す
    fetch(`${api}/api/me/talk-rooms`, { headers })
      .then((r) => r.json())
      .then((rooms) => setPartner(rooms.find((r: any) => r.room_id === roomId)))
    load(1)
    // 開いたら、いちばん下（新しいもの）を見せる。届くまでの時間は考えず、少し待ってから動かす
    setTimeout(() => {
      const box = document.querySelector('.frame-main')
      if (box) box.scrollTop = box.scrollHeight
    }, 500)
    // 5秒ごとに1ページ目を読み直す。前の呼び出しが終わっていなくても、次を呼ぶ。新しいものがなくても50件を読む
    const timer = setInterval(() => load(1), 5000)
    return () => clearInterval(timer)
  }, [roomId])

  useEffect(() => {
    // スクロールするのは枠の中（.frame-main）なので、その要素を探して見張る
    const box = document.querySelector('.frame-main')
    if (!box) return
    const onScroll = () => {
      // いちばん上まで来たら、古い続きを読む。足したあと、見ていた位置は押し出される（直さない）
      if (!done && box.scrollTop === 0) {
        load(page + 1)
      }
    }
    box.addEventListener('scroll', onScroll)
    return () => box.removeEventListener('scroll', onScroll)
  }, [page, done, messages])

  // 07：男性の無料の会員は送れない（is_paid だけを見る。API の判断を、画面にも写す）
  const locked = myGender === 'male' && !me?.is_paid

  const send = (e: any) => {
    e.preventDefault()
    if (locked) {
      setUpsell(true)
      return
    }
    // 入力を確かめない。空のまま送ると API が 500 を返すが、何も出さない
    fetch(`${api}/api/me/talk-rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }).then(() => {
      setBody('')
      load(1)
      setTimeout(() => {
        const box = document.querySelector('.frame-main')
        if (box) box.scrollTop = box.scrollHeight
      }, 300)
    })
  }

  // 06：相手をブロックする（相手の public_id は、トークの一覧から探したもの）。ステータスを見ない
  const block = () => {
    fetch(`${api}/api/me/blocks`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: partner?.user_id }),
    }).then(() => navigate('/messages'))
  }

  return (
    <div className="talk">
      <div className="talk-head">
        <button className="button button-small button-ghost" onClick={() => navigate('/messages')}>
          ←
        </button>
        {partner?.image && <img className="row-avatar" src={`${api}${partner.image}`} />}
        <span className="row-name">{partner?.nickname ?? ''}</span>
        <button className="danger-link talk-block" onClick={() => setConfirming(true)}>
          ブロック
        </button>
      </div>

      {confirming && (
        // 06：確かめのモーダル（相手のプロフィールから写した）
        <div className="modal-back" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">{partner?.nickname}さんをブロックしますか？</p>
            <p>お互いに、検索・いいね・メッセージに出なくなります。あとで解除できます。</p>
            <button className="button button-danger" onClick={block}>
              ブロックする
            </button>
            <button className="button button-ghost" onClick={() => setConfirming(false)}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {done && messages.length > 0 && <p className="soon">これより前のメッセージはありません</p>}

      <ul className="talk-list">
        {messages.map((m) => (
          // 自分のものかは、中の連番の sender_id と、/api/me の id を比べて決める
          <li key={m.id} className={m.sender_id === me?.id ? 'bubble bubble-mine' : 'bubble'}>
            <span className="bubble-body">{m.body}</span>
            <span className="bubble-time">
              {new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
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
        <button className="button button-small">送る{locked && <span className="paid-mark">有料</span>}</button>
      </form>
      {upsell && (
        // 07：誘導のモーダル（送る・検索・いいねの画面に、同じものを書く）
        <div className="modal-back" onClick={() => setUpsell(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">有料会員になると使えます</p>
            <p>メッセージを送る・いいねを何回でも・身長で探す、が使えるようになります。</p>
            <button className="button" onClick={() => navigate('/plans')}>
              有料会員になる
            </button>
            <button className="button button-ghost" onClick={() => setUpsell(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
