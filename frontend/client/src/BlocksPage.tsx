import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import Button from './components/Button'
import EmptyState from './components/EmptyState'
import Icon from './components/Icon'
import { SkeletonRows } from './components/Skeleton'
import { useToast } from './components/Toast'

// レガシー版（06）。ブロックした相手（/blocks）。ホームから開く。いいねの一覧の画面を写して、全部この部品に書く
export default function BlocksPage() {
  const [blocks, setBlocks] = useState<any[] | null>(null)
  // 03c：解除の結果はトーストで出す（FR-UI-024）。解除している行のボタンにスピナー
  const toast = useToast()
  const [busy, setBusy] = useState('')
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
    setBusy(userId)
    // 確かめずに、すぐ解除する。ステータスを見ない。終わったら一覧を全部読み直す
    fetch(`${api}/api/me/blocks/${userId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    }).then(() => {
      setBusy('')
      toast('解除しました')
      load()
    })
  }

  if (!blocks) return <SkeletonRows />

  return (
    <div>
      <div className="talk-head">
        <button
          type="button"
          className="icon-button"
          aria-label="ホームへ戻る"
          onClick={() => navigate('/home', { viewTransition: true })}
        >
          <Icon name="back" />
        </button>
        <span className="row-name">ブロックした相手</span>
      </div>
      {blocks.length === 0 && <EmptyState icon="lock" text="ブロックした相手はいません" />}
      <ul className="list">
        {blocks.map((b) => (
          // 同じ相手は1回しかブロックできないので、相手の id を key にする
          <li key={b.user_id} className="row">
            <Avatar image={b.image} name={b.nickname} />
            <div className="row-body">
              {/* 退会した相手も、名前つきでそのまま出る */}
              <div className="row-name">{b.nickname ?? '退会した会員'}</div>
              <div className="row-sub">
                {new Date(b.blocked_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} にブロック
              </div>
            </div>
            <Button
              variant="ghost"
              small
              className="row-action"
              loading={busy === b.user_id}
              onClick={() => unblock(b.user_id)}
            >
              解除
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
