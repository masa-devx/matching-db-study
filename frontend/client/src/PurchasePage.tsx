import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, ignoreApiError } from './api/ApiError'
import { billingApi } from './api/billingApi'
import { profileApi } from './api/profileApi'
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
  // M8（#198）：どの画面から来たか。買ったあと、そこに戻す（なければ、プランの一覧）
  const from = useLocation().state?.from

  useEffect(() => {
    // 1つのプランを読む API はないので、一覧を全部読んで探す。男性でなければ 403 でホームに戻す
    billingApi.plans().then(
      (rows) => setPlan(rows.find((p: any) => String(p.id) === planId)),
      (e) => {
        if (e instanceof ApiError && e.status === 403) {
          navigate('/home')
          return
        }
        throw e
      },
    )
    profileApi.accountRecord().then(setMe)
  }, [planId])

  const buy = () => {
    setSending(true)
    billingApi
      .purchase(plan.id)
      .catch(ignoreApiError)
      .then(() => {
        // ステータスを見ない
        toast('有料会員になりました')
        // M8：トークや検索から来た人は、その画面に戻す（買った目的を、すぐ果たせるように）
        navigate(from ?? '/plans', { viewTransition: true })
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
        <p>期間：{plan.months}か月</p>
        {/* M8：今の期限と、そこから延びることを、はっきり書く（2重に払うことにならないかが、分からなかった） */}
        {me.is_paid && me.paid_until && (
          <p>
            今の期限：{new Date(me.paid_until).toLocaleDateString('ja-JP')}（今の期限に、{plan.months}
            か月を足します。残りの期間は、なくなりません）
          </p>
        )}
        <p>購入すると、{until.toLocaleDateString('ja-JP')} まで有料会員になります。</p>
        <p className="muted-text">これは学習用です。お金は払いません。</p>
      </div>
      <Button onClick={buy} loading={sending}>
        購入する
      </Button>
    </div>
  )
}
