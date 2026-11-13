import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

// レガシー版（06）。ブロックした相手（/blocks）。ホームから開く。いいねの一覧の画面を写して、全部この部品に書く
export default function BlocksPage() {
  const [blocks, setBlocks] = useState<any[] | null>(null)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  const load = () => {
    // 読み込み中・失敗は考えない
    fetch(`${api}/api/me/blocks`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setBlocks)
  }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    load()
  }, [])

  const unblock = (userId: string) => {
    // 確かめずに、すぐ解除する。ステータスを見ない。終わったら一覧を全部読み直す
    fetch(`${api}/api/me/blocks/${userId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    }).then(() => {
      setMessage('解除しました')
      load()
    })
  }

  if (!blocks) return null

  return (
    <div>
      <div className="talk-head">
        <button className="button button-small button-ghost" onClick={() => navigate('/home')}>
          ←
        </button>
        <span className="row-name">ブロックした相手</span>
      </div>
      {message && <p className="toast">{message}</p>}
      {blocks.length === 0 && <p className="soon">ブロックした相手はいません</p>}
      <ul className="list">
        {blocks.map((b) => (
          // 同じ相手は1回しかブロックできないので、相手の id を key にする
          <li key={b.user_id} className="row">
            {b.image ? (
              <img className="row-avatar" src={`${api}${b.image}`} />
            ) : (
              <div className="row-avatar me-avatar-empty">?</div>
            )}
            <div className="row-body">
              {/* 退会した相手も、名前つきでそのまま出る */}
              <div className="row-name">{b.nickname ?? '退会した会員'}</div>
              <div className="row-sub">
                {new Date(b.blocked_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} にブロック
              </div>
            </div>
            <button className="button button-small button-ghost row-action" onClick={() => unblock(b.user_id)}>
              解除
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
