import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import Button from './components/Button'
import EmptyState from './components/EmptyState'
import MatchCelebration from './components/MatchCelebration'
import { SkeletonRows } from './components/Skeleton'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'

// レガシー版（M3。#184）。いいねのタブ（/likes）＝相手から届いたいいねの一覧。
// 1人ずつ「マッチする」（いいねを送り返す）か「スキップ」（見送る。相手には伝わらない）を選ぶ。
// スキップした相手の一覧も、この画面の下に置く（元に戻せる）。
// 送ったいいねの一覧は SentLikesPage（/likes/sent）に移し、設定から開く。取る・送る・見せるを、全部この部品に書く
export default function LikesPage() {
  const [likes, setLikes] = useState<any[] | null>(null)
  const [skips, setSkips] = useState<any[]>([])
  // 送っているあいだ、その相手のボタンを押せなくする（相手の ID を入れる）
  const [busy, setBusy] = useState('')
  const [upsell, setUpsell] = useState(false)
  // マッチの演出に出す、自分と相手
  const [matched, setMatched] = useState<any>(null)
  const toast = useToast()
  const navigate = useNavigate()

  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
  }

  // 届いたいいねと、スキップした相手を読む（2本。失敗・401 は考えない）
  const load = () => {
    fetch(`${api}/api/me/received-likes`, { headers })
      .then((r) => r.json())
      .then(setLikes)
    fetch(`${api}/api/me/skips`, { headers })
      .then((r) => r.json())
      .then(setSkips)
  }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    load()
  }, [])

  // マッチする：いいねを送り返す（今ある POST /api/me/likes）。相手からのいいねがあるので、マッチになる
  const match = async (like: any) => {
    setBusy(like.user_id)
    const r = await fetch(`${api}/api/me/likes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: like.user_id }),
    })
    setBusy('')
    // 送り返すいいねは、1日10回の数に入れない（#184）。それでも 403 が返ったら、誘導のモーダルを出す
    if (r.status === 403) {
      setUpsell(true)
      return
    }
    if (!r.ok) {
      toast('マッチできませんでした', 'error')
      return
    }
    // マッチの演出に出す自分の写真を、ここで読む（相手のプロフィールの画面と同じ2本を、ここにも書いた）
    const me = await fetch(`${api}/api/me`, { headers }).then((x) => x.json())
    const mine = await fetch(`${api}/api/users/${me.public_id}`, { headers }).then((x) => x.json())
    // M3（#187）：応答のトークルームの ID を、演出の「メッセージを送る」に渡す
    const d = await r.json()
    setMatched({ me: mine.profile ?? {}, partner: like, roomId: d.room_id })
    setLikes((before) => (before ?? []).filter((x) => x.user_id !== like.user_id))
  }

  // スキップ：この相手を、届いたいいねと検索に出さないようにする
  const skip = (like: any) => {
    setBusy(like.user_id)
    fetch(`${api}/api/me/skips`, { method: 'POST', headers, body: JSON.stringify({ user_id: like.user_id }) }).then(
      (r) => {
        setBusy('')
        if (!r.ok) {
          toast('スキップできませんでした', 'error')
          return
        }
        toast('スキップしました')
        load()
      },
    )
  }

  // スキップを元に戻す：また、届いたいいねと検索に出るようになる
  const restore = (s: any) => {
    setBusy(s.user_id)
    fetch(`${api}/api/me/skips/${s.user_id}`, { method: 'DELETE', headers }).then((r) => {
      setBusy('')
      if (!r.ok) {
        toast('元に戻せませんでした', 'error')
        return
      }
      toast('元に戻しました')
      load()
    })
  }

  // 年齢の計算を、またここにも書いた（誕生日の前だと1歳多い）
  const age = (birthday: any) => (birthday ? `${new Date().getFullYear() - Number(birthday.slice(0, 4))}歳` : '')

  // 03c：読み込み中は、行と同じ形のスケルトン（FR-UI-025）
  if (!likes) return <SkeletonRows />

  return (
    <div>
      <h1 className="page-title">いいね</h1>
      <p className="likes-lead">
        あなたにいいねした人です。「マッチする」でメッセージを送れるようになります。スキップしても、相手には伝わりません。
      </p>
      {/* 03c：空のときは、次にやることを1つ出す（FR-UI-033） */}
      {likes.length === 0 && (
        <EmptyState icon="heart" text="まだ、いいねは届いていません" actionLabel="検索で相手を探す" to="/search" />
      )}
      <ul className="likes-list">
        {likes.map((like) => (
          <li key={like.user_id} className="card likes-card">
            <Link to={`/users/${like.user_id}`} viewTransition className="likes-person">
              <Avatar image={like.image} name={like.nickname} />
              <div className="row-body">
                <div className="row-name">
                  {like.nickname ?? '退会した会員'} <span className="row-age">{age(like.birthday)}</span>
                </div>
                <div className="row-sub">
                  {like.prefecture ?? ''}{' '}
                  {new Date(like.liked_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} にいいね
                </div>
              </div>
            </Link>
            <div className="likes-actions">
              <Button variant="ghost" disabled={busy === like.user_id} onClick={() => skip(like)}>
                スキップ
              </Button>
              <Button loading={busy === like.user_id} onClick={() => match(like)}>
                マッチする
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* スキップした相手。ふだんは閉じておく。元に戻すと、また上の一覧と検索に出る */}
      {skips.length > 0 && (
        <details className="likes-skipped">
          <summary>スキップした相手（{skips.length}人）</summary>
          <ul className="list">
            {skips.map((s, i) => (
              // 同じ相手を2回スキップすると、API が2行返す（UNIQUE がない）ので、key に順番も入れる
              <li key={`${s.user_id}-${i}`} className="row">
                <Avatar image={s.image} name={s.nickname} />
                <div className="row-body">
                  <div className="row-name">
                    {s.nickname ?? '退会した会員'} <span className="row-age">{age(s.birthday)}</span>
                  </div>
                  <div className="row-sub">
                    {new Date(s.skipped_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} にスキップ
                  </div>
                </div>
                <button
                  type="button"
                  className="button button-small button-ghost"
                  aria-label={`${s.nickname ?? '退会した会員'}さんのスキップを元に戻す`}
                  disabled={busy === s.user_id}
                  onClick={() => restore(s)}
                >
                  元に戻す
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <UpsellDialog open={upsell} onClose={() => setUpsell(false)} />
      {matched && <MatchCelebration
          me={matched.me}
          partner={matched.partner}
          roomId={matched.roomId}
          onClose={() => setMatched(null)}
        />}
    </div>
  )
}
