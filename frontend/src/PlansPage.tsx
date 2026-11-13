import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from './components/Icon'
import { SkeletonRows } from './components/Skeleton'

// レガシー版（07）。プランの一覧（/plans）。男性の会員だけ。今の状態・プラン・購入の記録を、全部この部品に書く
export default function PlansPage() {
  const [plans, setPlans] = useState<any[] | null>(null)
  const [me, setMe] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const headers = { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 男性でなければ API が 403 を返すので、ホームに戻す（画面では性別を確かめない）
    fetch(`${api}/api/plans`, { headers }).then(async (r) => {
      if (r.status === 403) {
        navigate('/home')
        return
      }
      setPlans(await r.json())
    })
    // 今の状態（is_paid・paid_until）は /api/me の users の行から読む
    fetch(`${api}/api/me`, { headers })
      .then((r) => r.json())
      .then(setMe)
    fetch(`${api}/api/me/purchases`, { headers })
      .then((r) => r.json())
      .then((rows) => setHistory(Array.isArray(rows) ? rows : []))
  }, [])

  if (!plans) return <SkeletonRows count={3} />

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
        <span className="row-name">有料会員</span>
      </div>

      <div className="card">
        {/* is_paid だけを見る（期限が過ぎていても「有料会員」と出る） */}
        {me?.is_paid ? (
          <p>有料会員です（{new Date(me.paid_until).toLocaleDateString('ja-JP')} まで）</p>
        ) : (
          <p>有料会員になると、メッセージを送る・いいねを何回でも・身長で探す、が使えます。</p>
        )}
      </div>

      <ul className="list">
        {plans.map((p) => (
          <li key={p.id}>
            <Link to={`/plans/${p.id}`} viewTransition className="row">
              <div className="row-body">
                <div className="row-name">{p.name}</div>
                <div className="row-sub">{p.price.toLocaleString()}円</div>
              </div>
              <span className="badge">選ぶ</span>
            </Link>
          </li>
        ))}
      </ul>

      {history.length > 0 && (
        <>
          <h2 className="section-title">購入の記録</h2>
          <ul className="list">
            {history.map((h, i) => (
              // 記録には ID がないので、並びの番号を key にする
              <li key={i} className="row">
                <div className="row-body">
                  <div className="row-name">{h.name}</div>
                  {/* 値段は「今の」プランの値段（変えると前の記録も変わる） */}
                  <div className="row-sub">
                    {new Date(h.bought_at).toLocaleDateString('ja-JP')} に {h.price?.toLocaleString()}円
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
