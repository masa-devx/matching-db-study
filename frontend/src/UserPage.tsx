import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

// レガシー版（03b）。相手のプロフィール。取る・持つ・見せる・決まりを、全部この部品に書く
export default function UserPage() {
  const { id } = useParams()
  const [user, setUser] = useState<any>(null)
  const [liked, setLiked] = useState(false)
  const [message, setMessage] = useState('')
  const [matched, setMatched] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない。すぐ別の人に移ると、前の人の応答があとから上書きする
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users/${id}/profile`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setUser)
    // もういいねしたかは、開いたときには分からない（その API がない）。押すまで「いいね」のまま
  }, [id])

  const like = () => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/likes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
      },
      body: JSON.stringify({ user_id: Number(id) }),
    })
      .then((r) => r.json())
      .then((d) => {
        // ステータスを見ない。2回目は API が 500 を返すが、matched がないので「いいねしました」と出る
        setLiked(true)
        if (d.matched) {
          setMatched(true)
        } else {
          setMessage('いいねしました')
        }
      })
  }

  // 年齢の計算もここに書く（年の引き算なので、誕生日の前だと1歳多い）
  const age = user?.profile?.birthday ? new Date().getFullYear() - Number(user.profile.birthday.slice(0, 4)) : ''
  // 画像のパスは API の側にあるので、送り先を前に付ける
  const image = user?.profile?.image
    ? `${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}${user.profile.image}`
    : ''

  if (!user) return null

  return (
    <div className="profile">
      <div className="photo">
        {image ? <img className="photo-img" src={image} /> : <div className="photo-empty">写真なし</div>}
        <div className="photo-caption">
          <div className="photo-name">
            {user.profile?.nickname} <span className="photo-age">{age}歳</span>
          </div>
          <div className="photo-sub">{user.profile?.prefecture}</div>
        </div>
      </div>

      <div className="chips">
        {user.profile?.prefecture && <span className="chip">{user.profile.prefecture}</span>}
        {user.profile?.height && <span className="chip">{user.profile.height}cm</span>}
      </div>

      <div className="card">
        <h2 className="section-title">自己紹介</h2>
        <p className="intro">{user.profile?.introduction || 'まだ書いていません'}</p>
      </div>

      {message && <p className="toast">{message}</p>}

      <div className="like-bar">
        <button className="like-button" onClick={like} disabled={liked}>
          <span className="like-heart">♥</span>
          {liked ? 'いいね済み' : 'いいね'}
        </button>
      </div>

      {matched && (
        // マッチしたときは、画面いっぱいに知らせる
        <div className="match-overlay">
          <p className="match-title">マッチしました！</p>
          {image && <img className="match-avatar" src={image} />}
          <p className="match-text">{user.profile?.nickname}さんも、あなたにいいねしていました</p>
          <button className="button button-white" onClick={() => setMatched(false)}>
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}
