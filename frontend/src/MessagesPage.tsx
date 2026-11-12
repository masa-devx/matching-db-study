import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

// レガシー版（03b）。メッセージのタブ（/messages）＝マッチした相手の一覧。
// 05 で、相手を押すとメッセージが開くように変える。それまでは相手のプロフィールに移る
// 送ったいいねの一覧（LikesPage）を写して作った
export default function MessagesPage() {
  const [matches, setMatches] = useState<any[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗は考えない。API が止まると、画面は空のまま
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/matches`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setMatches)
  }, [])

  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  if (!matches) return null

  return (
    <div>
      <h1 className="page-title">メッセージ</h1>
      {matches.length === 0 && <p className="soon">まだマッチした相手はいません</p>}
      <ul className="list">
        {matches.map((m) => (
          // API は同じ相手とのマッチを2行返すことがある（03 で測った重複）。そのときは key が重なる
          <li key={m.user_id}>
            <Link to={`/users/${m.user_id}`} className="row">
              {m.image ? (
                <img className="row-avatar" src={`${api}${m.image}`} />
              ) : (
                <div className="row-avatar me-avatar-empty">?</div>
              )}
              <div className="row-body">
                <div className="row-name">
                  {m.nickname ?? '退会した会員'} {/* 年齢の計算を、また写した（誕生日の前だと1歳多い） */}
                  {m.birthday && (
                    <span className="row-age">{new Date().getFullYear() - Number(m.birthday.slice(0, 4))}歳</span>
                  )}
                </div>
                <div className="row-sub">マッチしました。メッセージは 05 で送れるようになります</div>
              </div>
              <span className="row-date">
                {new Date(m.matched_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
