import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import EmptyState from './components/EmptyState'
import { SkeletonRows } from './components/Skeleton'

// レガシー版（03b）。いいねのタブ（/likes）＝送ったいいねの一覧。取る・持つ・見せるを、全部この部品に書く
export default function LikesPage() {
  const [likes, setLikes] = useState<any[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない。API が止まると、画面は空のまま
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/likes`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setLikes)
  }, [])

  // 03c：読み込み中は、行と同じ形のスケルトン（FR-UI-025）
  if (!likes) return <SkeletonRows />

  return (
    <div>
      <h1 className="page-title">送ったいいね</h1>
      {/* 03c：空のときは、次にやることを1つ出す（FR-UI-033） */}
      {likes.length === 0 && (
        <EmptyState icon="heart" text="まだ、だれにもいいねしていません" actionLabel="検索で相手を探す" to="/search" />
      )}
      <ul className="list">
        {likes.map((like) => (
          // 同じ相手は1回しか送れないので、相手の id を key にする
          <li key={like.user_id}>
            <Link to={`/users/${like.user_id}`} viewTransition className="row">
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
          </li>
        ))}
      </ul>
    </div>
  )
}
