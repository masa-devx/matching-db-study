import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ConfirmDialog from './components/ConfirmDialog'
import Icon from './components/Icon'
import MatchCelebration from './components/MatchCelebration'
import ReportDialog from './components/ReportDialog'
import { SkeletonProfile } from './components/Skeleton'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'
import { apiFetch, apiUrl, StoppedRequestError } from './shared/api/client'

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
  // M7（#202）：通報のモーダルを開いているか
  const [reporting, setReporting] = useState(false)
  // M3（#187）：マッチしてできたトークルームの ID（いいねの応答か、プロフィールの応答から）
  const [roomId, setRoomId] = useState<any>(null)
  // 06：ブロックの確かめのモーダルを開いているか
  const [confirming, setConfirming] = useState(false)
  // 07：誘導のモーダル（いいねの上限を超えたとき）
  const [upsell, setUpsell] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  useEffect(() => {
    // 読み込み中・失敗は考えない。すぐ別の人に移ると、前の人の応答があとから上書きする
    apiFetch(`/api/users/${publicId}`, { headers })
      .then((r) => {
        return r.json()
      })
      .then((u) => {
        setUser(u)
        // M3（#187）：もうマッチしていれば、「メッセージを送る」を出す
        setRoomId(u.room_id ?? null)
      })
    // もういいねしたかは、開いたときには分からない（その API がない）。押すまで「いいね」のまま
  }, [publicId])

  const like = () =>
    startTransition(async () => {
      try {
        setShownLiked(true)
        const r = await apiFetch(`/api/me/likes`, {
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
          setRoomId(d.room_id ?? null)
          // マッチの演出に出す自分の写真を、ここで読む（ホームと同じ2本を写す）
          const me = await apiFetch(`/api/me`, { headers }).then((x) => x.json())
          const res = await apiFetch(`/api/users/${me.public_id}`, { headers })
          const mine = await res.json()
          setMatchedWith(mine.profile ?? {})
        } else {
          toast('いいねしました')
        }
      } catch (e) {
        // 401 と、メールアドレスを確認していない 403 は、client.ts が続きを止める。ここで受け止めないと、遷移の中の失敗として画面全体が外れる
        if (!(e instanceof StoppedRequestError)) throw e
      }
    })

  // M3（#187）：スキップする。届いたいいねの画面（LikesPage）に書いた送り方を、ここにもコピーした
  const skip = () => {
    apiFetch(`/api/me/skips`, { method: 'POST', headers, body: JSON.stringify({ user_id: publicId }) }).then((r) => {
      if (!r.ok) {
        toast('スキップできませんでした', 'error')
        return
      }
      toast('スキップしました')
      navigate(-1)
    })
  }

  // 06：ブロックする。ステータスを見ない（2回目は 500 でも「ブロックしました」と出る）
  const block = () => {
    apiFetch(`/api/me/blocks`, { method: 'POST', headers, body: JSON.stringify({ user_id: publicId }) }).then(() => {
      setConfirming(false)
      toast('ブロックしました')
      // 前の画面に戻る（戻った先は読み直すが、検索の一覧は条件を残したまま1ページ目から）
      navigate(-1)
    })
  }

  // 年齢の計算もここに書く（年の引き算なので、誕生日の前だと1歳多い）
  const age = user?.profile?.birthday ? new Date().getFullYear() - Number(user.profile.birthday.slice(0, 4)) : ''
  // 画像のパスは API の側にあるので、送り先を前に付ける
  const image = user?.profile?.image ? apiUrl(user.profile.image) : ''

  // 03c：読み込み中は、中身と同じ形のスケルトン（FR-UI-025）
  if (!user) return <SkeletonProfile />

  return (
    <div className="profile">
      {/* 03c：検索のカードの写真と同じ名前を付け、写真がそのまま大きくなってつながる（FR-UI-029） */}
      <div className="photo" style={{ viewTransitionName: `photo-${publicId}` }}>
        {/* M9（#198）：戻るボタン。前は、ブラウザの「戻る」しかなかった。リンクを直接開いたとき（前の画面がない）は、検索へ */}
        <button
          type="button"
          className="icon-button photo-back"
          aria-label="前の画面へ戻る"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/search'))}
        >
          <Icon name="back" />
        </button>
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
          {/* #153：検索に使う6項目。答えたものだけ出す */}
          {user.profile?.body_type && <span className="chip">体型：{user.profile.body_type}</span>}
          {user.profile?.job && <span className="chip">お仕事：{user.profile.job}</span>}
          {user.profile?.income && <span className="chip">年収：{user.profile.income}</span>}
          {user.profile?.smoking && <span className="chip">タバコ：{user.profile.smoking}</span>}
          {user.profile?.drinking && <span className="chip">お酒：{user.profile.drinking}</span>}
          {user.profile?.marital_status && <span className="chip">結婚歴：{user.profile.marital_status}</span>}
        </div>

        <div className="card">
          <h2 className="section-title">自己紹介</h2>
          <p className="intro">{user.profile?.introduction || 'まだ書いていません'}</p>
        </div>

        {/* M3（#187）：マッチした相手には、いいねの代わりに「メッセージを送る」を出す */}
        {roomId && (
          <div className="like-bar">
            <Link to={`/messages/${roomId}`} viewTransition className="button">
              メッセージを送る
            </Link>
          </div>
        )}
        <div className={roomId ? 'like-bar hidden-range' : 'like-bar'}>
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

        {/* M3（#187）：検索で見た相手を、スキップできる（次から、検索と届いたいいねに出さない。相手には伝わらない）。マッチした相手には出さない */}
        {!roomId && (
          <button type="button" className="skip-link" onClick={skip}>
            スキップ（次から表示しない）
          </button>
        )}
        <button type="button" className="danger-link" onClick={() => setConfirming(true)}>
          ブロック
        </button>
        {/* M7（#202）：困った相手を、運営に伝える */}
        <button type="button" className="danger-link" onClick={() => setReporting(true)}>
          通報
        </button>
      </div>

      <ReportDialog
        open={reporting}
        userId={publicId ?? ''}
        nickname={user.profile?.nickname ?? ''}
        onClose={() => setReporting(false)}
        // ブロックもしたら、ブロックのときと同じく、前の画面に戻る
        onDone={(blocked) => blocked && navigate(-1)}
      />

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
        <MatchCelebration
          me={matchedWith}
          partner={user.profile ?? {}}
          roomId={roomId}
          onClose={() => setMatchedWith(null)}
        />
      )}
    </div>
  )
}
