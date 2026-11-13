import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { useNavigate, useParams } from 'react-router'
import ConfirmDialog from './components/ConfirmDialog'
import Icon from './components/Icon'
import MatchCelebration from './components/MatchCelebration'
import { SkeletonProfile } from './components/Skeleton'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'

// レガシー版（03b）。相手のプロフィール。取る・持つ・見せる・決まりを、全部この部品に書く
// 03c：モーダル・トースト・スケルトン・マッチの演出は components/ の部品を使う
export default function UserPage() {
  // #46：URL の会員の ID は UUID（public_id）
  const { publicId } = useParams()
  const [user, setUser] = useState<any>(null)
  const [liked, setLiked] = useState(false)
  // 03c：押した瞬間に「いいね済み」に見せる（応答を待たない。FR-UI-027）。失敗したら、終わったときに元に戻る
  const [shownLiked, setShownLiked] = useOptimistic(liked)
  const [, startTransition] = useTransition()
  // マッチの演出に出す自分（写真とニックネーム）
  const [matchedWith, setMatchedWith] = useState<any>(null)
  // 06：ブロックの確かめのモーダルを開いているか
  const [confirming, setConfirming] = useState(false)
  // 07：誘導のモーダル（いいねの上限を超えたとき）
  const [upsell, setUpsell] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
  }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない。すぐ別の人に移ると、前の人の応答があとから上書きする
    fetch(`${api}/api/users/${publicId}`, { headers })
      .then((r) => r.json())
      .then(setUser)
    // もういいねしたかは、開いたときには分からない（その API がない）。押すまで「いいね」のまま
  }, [publicId])

  const like = () =>
    startTransition(async () => {
      setShownLiked(true)
      const r = await fetch(`${api}/api/me/likes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: publicId }),
      })
      // 07：無料の男性が1日10回を超えると 403。画面では何回目かが分からないので、断られてからモーダルを出す
      if (r.status === 403) {
        setUpsell(true)
        return
      }
      if (!r.ok) {
        // 2回目のいいね（500）などは、失敗のトースト。ハートは元に戻る
        toast('いいねできませんでした', 'error')
        return
      }
      const d = await r.json()
      setLiked(true)
      if (d.matched) {
        // マッチの演出に出す自分の写真を、ここで読む（ホームと同じ2本を写す）
        const me = await fetch(`${api}/api/me`, { headers }).then((x) => x.json())
        const mine = await fetch(`${api}/api/users/${me.public_id}`, { headers }).then((x) => x.json())
        setMatchedWith(mine.profile ?? {})
      } else {
        toast('いいねしました')
      }
    })

  // 06：ブロックする。ステータスを見ない（2回目は 500 でも「ブロックしました」と出る）
  const block = () => {
    fetch(`${api}/api/me/blocks`, { method: 'POST', headers, body: JSON.stringify({ user_id: publicId }) }).then(() => {
      setConfirming(false)
      toast('ブロックしました')
      // 前の画面に戻る（戻った先は読み直すが、検索の一覧は条件を残したまま1ページ目から）
      navigate(-1)
    })
  }

  // 年齢の計算もここに書く（年の引き算なので、誕生日の前だと1歳多い）
  const age = user?.profile?.birthday ? new Date().getFullYear() - Number(user.profile.birthday.slice(0, 4)) : ''
  // 画像のパスは API の側にあるので、送り先を前に付ける
  const image = user?.profile?.image ? `${api}${user.profile.image}` : ''

  // 03c：読み込み中は、中身と同じ形のスケルトン（FR-UI-025）
  if (!user) return <SkeletonProfile />

  return (
    <div className="profile">
      {/* 03c：検索のカードの写真と同じ名前を付け、写真がそのまま大きくなってつながる（FR-UI-029） */}
      <div className="photo" style={{ viewTransitionName: `photo-${publicId}` }}>
        {image ? (
          <img className="photo-img" src={image} alt="" />
        ) : (
          <div className="photo-empty">{(user.profile?.nickname ?? '?').slice(0, 1)}</div>
        )}
        <div className="photo-caption">
          <div className="photo-name">
            {user.profile?.nickname} <span className="photo-age">{age}歳</span>
          </div>
          <div className="photo-sub">{user.profile?.prefecture}</div>
        </div>
      </div>

      <div className="profile-body">
        <div className="chips">
          {user.profile?.prefecture && <span className="chip">{user.profile.prefecture}</span>}
          {user.profile?.height && <span className="chip">{user.profile.height}cm</span>}
        </div>

        <div className="card">
          <h2 className="section-title">自己紹介</h2>
          <p className="intro">{user.profile?.introduction || 'まだ書いていません'}</p>
        </div>

        <div className="like-bar">
          <button
            type="button"
            className={shownLiked ? 'like-button is-liked' : 'like-button'}
            onClick={like}
            disabled={shownLiked}
            aria-pressed={shownLiked}
          >
            <span className="like-heart">
              <Icon name="heart" filled={shownLiked} />
            </span>
            {shownLiked ? 'いいね済み' : 'いいね'}
          </button>
        </div>

        <button type="button" className="danger-link" onClick={() => setConfirming(true)}>
          ブロック
        </button>
      </div>

      <UpsellDialog open={upsell} onClose={() => setUpsell(false)} />
      <ConfirmDialog
        open={confirming}
        title={`${user.profile?.nickname}さんをブロックしますか？`}
        confirmLabel="ブロックする"
        danger
        onConfirm={block}
        onClose={() => setConfirming(false)}
      >
        <p>お互いに、検索・いいね・メッセージに出なくなります。あとで解除できます。</p>
      </ConfirmDialog>

      {matchedWith && (
        <MatchCelebration me={matchedWith} partner={user.profile ?? {}} onClose={() => setMatchedWith(null)} />
      )}
    </div>
  )
}
