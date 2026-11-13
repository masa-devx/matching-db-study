import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Button from './components/Button'
import Icon from './components/Icon'
import { SkeletonProfile } from './components/Skeleton'
import { useToast } from './components/Toast'

// レガシー版（07）。購入の画面（/plans/:planId）。内容を確かめて「購入する」を押す。決済はしない（押したらすぐ有料）
export default function PurchasePage() {
  const { planId } = useParams()
  const [plan, setPlan] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const headers = { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 1つのプランを読む API はないので、一覧を全部読んで探す。男性でなければ 403 でホームに戻す
    fetch(`${api}/api/plans`, { headers }).then(async (r) => {
      if (r.status === 403) {
        navigate('/home')
        return
      }
      const rows = await r.json()
      setPlan(rows.find((p: any) => String(p.id) === planId))
    })
    fetch(`${api}/api/me`, { headers })
      .then((r) => r.json())
      .then(setMe)
  }, [planId])

  const buy = () => {
    setSending(true)
    fetch(`${api}/api/me/purchases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: plan.id }),
    }).then(() => {
      // ステータスを見ない
      toast('有料会員になりました')
      navigate('/plans', { viewTransition: true })
    })
  }

  if (!plan || !me) return <SkeletonProfile />

  // 購入したあとの期限：API と同じ計算を画面にも写す（今の期限、なければ今に月を足す。期限が過ぎていても古い期限から）
  const base = me.paid_until ? new Date(me.paid_until) : new Date()
  const until = new Date(base)
  until.setMonth(until.getMonth() + plan.months)

  return (
    <div>
      <div className="talk-head">
        <button
          type="button"
          className="icon-button"
          aria-label="プランの一覧へ戻る"
          onClick={() => navigate('/plans', { viewTransition: true })}
        >
          <Icon name="back" />
        </button>
        <span className="row-name">購入の確かめ</span>
      </div>
      <div className="card">
        <h2 className="section-title">{plan.name}</h2>
        <p>{plan.price.toLocaleString()}円</p>
        <p>購入すると、{until.toLocaleDateString('ja-JP')} まで有料会員になります。</p>
        <p className="muted-text">これは学習用です。お金は払いません。</p>
      </div>
      <Button onClick={buy} loading={sending}>
        購入する
      </Button>
    </div>
  )
}
