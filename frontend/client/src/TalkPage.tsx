import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Avatar from './components/Avatar'
import Button from './components/Button'
import ConfirmDialog from './components/ConfirmDialog'
import Icon from './components/Icon'
import { SkeletonTalk } from './components/Skeleton'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'

// レガシー版（05）。トーク画面（/messages/:roomId）。取る・続き・5秒ごとの読み直し・送る・見せるを、全部この部品に書く。
// M6（#190）：作り直した。相手のプロフィールへのリンク・日付の区切り・相手の吹き出しに写真・改行できる入力欄・
// 失敗しても文が消えない・新しいメッセージの知らせ・まだ1通もないときの案内・無料と有料の出し分け（送る・既読）
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
  // 03c：最初の1ページが届くまではスケルトン（FR-UI-025）。送っている間の吹き出し（FR-UI-030）
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState<any[]>([])
  // M6：上を読んでいるときに、新しいメッセージが届いたか（「新しいメッセージ」の知らせを出す）
  const [newBelow, setNewBelow] = useState(false)
  // 前に見たときの、いちばん新しいメッセージの id（5秒ごとの読み直しは、古い messages を覚えたまま動くので、ここで比べる）
  const lastId = useRef<any>(null)
  const toast = useToast()
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
        setLoaded(true)
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
    // 相手の名前と写真を出すために、トークの一覧を全部読んで、このルームを探す。
    // M6：既読（相手が最後に開いた日時）もここに入っているので、5秒ごとに、一覧も全部読み直す
    const loadPartner = () =>
      fetch(`${api}/api/me/talk-rooms`, { headers })
        .then((r) => r.json())
        .then((rooms) => setPartner(rooms.find((r: any) => r.room_id === roomId)))
    loadPartner()
    load(1)
    // 開いたら、いちばん下（新しいもの）を見せる。届くまでの時間は考えず、少し待ってから動かす
    setTimeout(() => {
      const box = document.querySelector('.frame-main')
      if (box) box.scrollTop = box.scrollHeight
    }, 500)
    // 5秒ごとに1ページ目を読み直す。前の呼び出しが終わっていなくても、次を呼ぶ。新しいものがなくても50件を読む
    // load は、このときの messages（空）を覚えたままなので、「新しいメッセージ」の知らせは、下の別の useEffect で見る
    const timer = setInterval(() => {
      load(1)
      loadPartner()
    }, 5000)
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
      // M6：いちばん下まで戻ったら、知らせを消す
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 80) setNewBelow(false)
    }
    box.addEventListener('scroll', onScroll)
    return () => box.removeEventListener('scroll', onScroll)
  }, [page, done, messages])

  // M6：いちばん新しいメッセージが変わったら（届いた・送った）、いちばん下を見ていれば下まで進め、
  // 上を読んでいれば「新しいメッセージ」の知らせを出す。古い続きを上に足したときは、いちばん新しい id が変わらないので、何もしない
  useEffect(() => {
    const last = messages.length > 0 ? messages[messages.length - 1].id : null
    if (lastId.current !== null && last !== null && last !== lastId.current) {
      const box = document.querySelector('.frame-main')
      // 新しい行が足されたあとの高さで比べるので、足された分（吹き出し1つ・およそ 160px まで）は、下にいたものとして扱う
      const atBottom = box ? box.scrollTop + box.clientHeight >= box.scrollHeight - 240 : true
      if (atBottom) {
        if (box) box.scrollTop = box.scrollHeight
      } else {
        setNewBelow(true)
      }
    }
    lastId.current = last
  }, [messages])

  // 07：男性の無料の会員は送れない（is_paid だけを見る。API の判断を、画面にも写す）
  const locked = myGender === 'male' && !me?.is_paid

  const send = (e: any) => {
    e.preventDefault()
    if (locked) {
      setUpsell(true)
      return
    }
    // M6：空（空白だけ）と、1000文字より長いものは、送らない（前は、空のまま送ると API が 500 を返した）
    if (!body.trim() || body.length > 1000) return
    // 03c：応答を待たずに、半分の濃さの吹き出しを下に出す（届いたら、読み直した一覧の濃い吹き出しに替わる）
    const temp = { id: `pending-${Date.now()}`, body, sender_id: me?.id, created_at: new Date().toISOString() }
    setPending((now) => [...now, temp])
    setBody('')
    setTimeout(() => {
      const box = document.querySelector('.frame-main')
      if (box) box.scrollTop = box.scrollHeight
    }, 50)
    // 入力を確かめない。空のまま送ると API が 500 を返す（03c から、失敗はトーストで出す）
    fetch(`${api}/api/me/talk-rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: temp.body }),
    }).then((r) => {
      setPending((now) => now.filter((m) => m.id !== temp.id))
      if (!r.ok) {
        // M6：送れなかった文を、入力欄に戻す（前は、文が消えていた）。そのあいだに別の文を書いていたら、戻さない
        setBody((now) => (now ? now : temp.body))
        toast('送れませんでした。もう一度送ってください', 'error')
        return
      }
      load(1)
    })
  }

  // 06：相手をブロックする（相手の public_id は、トークの一覧から探したもの）。ステータスを見ない
  const block = () => {
    fetch(`${api}/api/me/blocks`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: partner?.user_id }),
    }).then(() => {
      toast('ブロックしました')
      navigate('/messages', { viewTransition: true })
    })
  }

  // M6：日付の区切りに出す言葉（今日・昨日・月日と曜日）。一覧の画面とは別に、ここにも日付の比べ方を書いた
  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = Math.round((day(now) - day(d)) / 86400000)
    if (diff === 0) return '今日'
    if (diff === 1) return '昨日'
    const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
    const year = d.getFullYear() === now.getFullYear() ? '' : `${d.getFullYear()}年`
    return `${year}${d.getMonth() + 1}月${d.getDate()}日（${week}）`
  }
  const dayKey = (iso: string) => new Date(iso).toDateString()

  // M6：既読。相手が最後に開いた日時より前の、自分のメッセージのうち、いちばん新しいものに「既読」を出す。
  // 既読が分かるのは、有料の機能（男性の無料の会員には出さない。判断は、送るのと同じ locked を使う）。
  // API は、無料の会員にも相手の日時を返している（出さないのは、この画面だけ）
  const all = [...messages, ...pending]
  let readId: any = null
  if (!locked && partner?.partner_last_read_at) {
    for (const m of messages) {
      if (m.sender_id === me?.id && new Date(m.created_at) <= new Date(partner.partner_last_read_at)) readId = m.id
    }
  }

  const toBottom = () => {
    const box = document.querySelector('.frame-main')
    if (box) box.scrollTop = box.scrollHeight
    setNewBelow(false)
  }

  return (
    <div className="talk">
      <div className="talk-head">
        <button
          type="button"
          className="icon-button"
          aria-label="トークの一覧へ戻る"
          onClick={() => navigate('/messages', { viewTransition: true })}
        >
          <Icon name="back" />
        </button>
        {/* M6：写真と名前を押すと、相手のプロフィールに移る（話題を探すために、見返せるように） */}
        {partner ? (
          <Link to={`/users/${partner.user_id}`} viewTransition className="talk-partner">
            <Avatar image={partner.image} name={partner.nickname} size={40} />
            <span className="talk-partner-text">
              <span className="row-name">{partner.nickname ?? '退会した会員'}</span>
              <span className="talk-partner-sub">プロフィールを見る</span>
            </span>
          </Link>
        ) : (
          <span className="talk-partner" />
        )}
        <button type="button" className="danger-link talk-block" onClick={() => setConfirming(true)}>
          ブロック
        </button>
      </div>

      {done && messages.length > 0 && <p className="talk-start">これより前のメッセージはありません</p>}

      {!loaded ? (
        <SkeletonTalk />
      ) : (
        <ul className="talk-list">
          {/* M6：まだ1通もないとき。何も出ない空の画面だったので、最初の一通をうながす */}
          {all.length === 0 && (
            <li className="talk-empty">
              {partner && <Avatar image={partner.image} name={partner.nickname} size={72} />}
              <p className="talk-empty-title">{partner?.nickname ?? ''}さんとマッチしました</p>
              <p className="talk-empty-text">
                最初のメッセージを送ってみましょう。プロフィールを見ると、話のきっかけが見つかります。
              </p>
            </li>
          )}
          {all.map((m, i) => {
            const mine = m.sender_id === me?.id
            const sending = String(m.id).startsWith('pending-')
            return (
              // 自分のものかは、中の連番の sender_id と、/api/me の id を比べて決める
              <li key={m.id} className="talk-item">
                {/* M6：日が変わる所に、日付の区切りを入れる */}
                {(i === 0 || dayKey(all[i - 1].created_at) !== dayKey(m.created_at)) && (
                  <div className="talk-day">
                    <span>{dayLabel(m.created_at)}</span>
                  </div>
                )}
                <div className={['msg', mine ? 'msg-mine' : 'msg-theirs', sending && 'is-pending'].filter(Boolean).join(' ')}>
                  {/* M6：相手の吹き出しには、小さい写真を付ける */}
                  {!mine && partner && <Avatar image={partner.image} name={partner.nickname} size={28} />}
                  <div className="msg-col">
                    <span className="bubble-body">{m.body}</span>
                    <span className="msg-meta">
                      {m.id === readId && <span className="msg-read">既読</span>}
                      {sending
                        ? '送信中…'
                        : new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* M6：上を読んでいるときに届いたら、知らせる。押すと、いちばん下へ */}
      {newBelow && (
        <button type="button" className="talk-new" onClick={toBottom}>
          新しいメッセージ ↓
        </button>
      )}

      {/* M6：無料と有料の出し分け。男性の無料の会員は、読めるが送れない。入力欄の代わりに、有料会員への案内を出す */}
      {locked ? (
        <div className="talk-locked">
          <p>
            <span className="paid-mark">有料</span>{' '}
            メッセージを送る・既読が分かる、は有料会員の機能です。届いたメッセージは読めます。
          </p>
          <Link to="/plans" viewTransition className="button">
            有料会員になる
          </Link>
        </div>
      ) : (
        <form className="talk-form" onSubmit={send}>
          {/* M6：改行できる入力欄（4行まで広がる）。送るのは、ボタンで */}
          <div className="talk-input">
            <textarea
              className="input"
              rows={Math.min(4, body.split('\n').length)}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="メッセージを入力"
              aria-label="メッセージ"
            />
            {/* 残りが少なくなったら、文字の数を出す（1000文字まで。FR-MSG-004） */}
            {body.length > 800 && (
              <span className={body.length > 1000 ? 'talk-count is-over' : 'talk-count'}>{body.length}／1000</span>
            )}
          </div>
          <Button type="submit" small disabled={!body.trim() || body.length > 1000}>
            送る
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={confirming}
        title={`${partner?.nickname ?? ''}さんをブロックしますか？`}
        confirmLabel="ブロックする"
        danger
        onConfirm={block}
        onClose={() => setConfirming(false)}
      >
        <p>お互いに、検索・いいね・メッセージに出なくなります。あとで解除できます。</p>
      </ConfirmDialog>
      <UpsellDialog open={upsell} onClose={() => setUpsell(false)} />
    </div>
  )
}
