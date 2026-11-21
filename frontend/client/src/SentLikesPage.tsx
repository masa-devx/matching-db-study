import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import EmptyState from './components/EmptyState'
import { SkeletonRows } from './components/Skeleton'
import { apiFetch } from './shared/api/client'
import { readToken } from './shared/session/session'

// レガシー版（03b）。送ったいいねの一覧。取る・持つ・見せるを、全部この部品に書く。
// M3（#184）：いいねのタブ（/likes）は、届いたいいね（LikesPage）にした。この画面は /likes/sent に移し、設定から開く
export default function SentLikesPage() {
  const [likes, setLikes] = useState<any[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!readToken()) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない。API が止まると、画面は空のまま
    apiFetch(`/api/me/likes`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then(setLikes)
  }, [])

  // 03c：読み込み中は、行と同じ形のスケルトン（FR-UI-025）
  if (!likes) return <SkeletonRows />

  return (
    <div>
      <div className="search-head">
        <h1 className="page-title">送ったいいね</h1>
        <Link className="button button-small button-ghost" to="/settings" viewTransition>
          戻る
        </Link>
      </div>
      {/* 03c：空のときは、次にやることを1つ出す（FR-UI-033） */}
      {likes.length === 0 && (
        <EmptyState icon="heart" text="まだ、だれにもいいねしていません" actionLabel="検索で相手を探す" to="/search" />
      )}
      <ul className="list">
        {likes.map((like) => (
          // 同じ相手は1回しか送れないので、相手の id を key にする
          // M3（#187）：行の中に、プロフィールへのリンクと、トークへのリンクを横に並べる（リンクの中にリンクは置けない）
          <li key={like.user_id} className="sent-row">
            <Link to={`/users/${like.user_id}`} viewTransition className="row sent-main">
              <Avatar image={like.image} name={like.nickname} />
              <div className="row-body">
                <div className="row-name">
                  {like.nickname ?? '退会した会員'} {/* 年齢の計算を、また写した（誕生日の前だと1歳多い） */}
                  {like.birthday && (
                    <span className="row-age">{new Date().getFullYear() - Number(like.birthday.slice(0, 4))}歳</span>
                  )}
                </div>
                <div className="row-sub">
                  {new Date(like.liked_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} にいいね
                </div>
              </div>
              {like.matched && <span className="badge">マッチ済み</span>}
            </Link>
            {like.matched && like.room_id && (
              <Link
                to={`/messages/${like.room_id}`}
                viewTransition
                className="button button-small button-ghost sent-talk"
                aria-label={`${like.nickname ?? '退会した会員'}さんにメッセージを送る`}
              >
                メッセージ
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
