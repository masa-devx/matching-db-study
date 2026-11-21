import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import Icon from './components/Icon'
import { SkeletonRows } from './components/Skeleton'
import { apiFetch } from './shared/api/client'

// レガシー版（07）。プランの一覧（/plans）。男性の会員だけ。今の状態・プラン・購入の記録を、全部この部品に書く
export default function PlansPage() {
  const [plans, setPlans] = useState<any[] | null>(null)
  const [me, setMe] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const navigate = useNavigate()
  // M8（#198）：どの画面から来たか（トーク・検索など）。買ったあと、そこに戻す
  const from = useLocation().state?.from
  const headers = { Accept: 'application/json' }

  useEffect(() => {
    // 男性でなければ API が 403 を返すので、ホームに戻す（画面では性別を確かめない）
    apiFetch(`/api/plans`, { headers }).then(async (r) => {
      if (r.status === 403) {
        navigate('/home')
        return
      }
      setPlans(await r.json())
    })
    // 今の状態（is_paid・paid_until）は /api/me の users の行から読む
    apiFetch(`/api/me`, { headers })
      .then((r) => r.json())
      .then(setMe)
    apiFetch(`/api/me/purchases`, { headers })
      .then((r) => r.json())
      .then((rows) => setHistory(Array.isArray(rows) ? rows : []))
  }, [])

  if (!plans) return <SkeletonRows count={3} />

  // M8：期限まで、あと何日か（期限がなければ null）
  const daysLeft = me?.paid_until ? Math.ceil((new Date(me.paid_until).getTime() - Date.now()) / 86400000) : null

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
          <>
            <p>有料会員です（{new Date(me.paid_until).toLocaleDateString('ja-JP')} まで）</p>
            {/* M8：期限が近い（7日以内）・過ぎたことを知らせる。日数の計算を、ここに書いた */}
            {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
              <p className="plan-soon">
                あと{daysLeft}日で、期限が切れます。続けて使うには、下のプランを選んでください。
              </p>
            )}
            {daysLeft !== null && daysLeft < 0 && (
              <p className="plan-soon">期限が過ぎています。続けて使うには、下のプランを選んでください。</p>
            )}
          </>
        ) : (
          <p>有料会員になると、できることが増えます。</p>
        )}
      </div>

      {/* M8：無料と有料で、何が変わるか。数字（1日10回・1000文字など）を、API とは別に、ここにも書いた */}
      <h2 className="section-title">無料と有料の違い</h2>
      <table className="plan-table">
        <thead>
          <tr>
            <th scope="col">できること</th>
            <th scope="col">無料</th>
            <th scope="col">有料</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">相手を探す・いいねを見る</th>
            <td>できる</td>
            <td>できる</td>
          </tr>
          <tr>
            <th scope="row">いいねを送る</th>
            <td>1日10回まで</td>
            <td>何回でも</td>
          </tr>
          <tr>
            <th scope="row">届いたいいねに「マッチする」</th>
            <td>何回でも</td>
            <td>何回でも</td>
          </tr>
          <tr>
            <th scope="row">メッセージを読む</th>
            <td>できる</td>
            <td>できる</td>
          </tr>
          <tr>
            <th scope="row">メッセージを送る</th>
            <td>できない</td>
            <td>できる</td>
          </tr>
          <tr>
            <th scope="row">既読が分かる</th>
            <td>分からない</td>
            <td>分かる</td>
          </tr>
          <tr>
            <th scope="row">検索のこだわり条件（最終ログイン・新しい会員・フリーワード・並び替え）</th>
            <td>使えない</td>
            <td>使える</td>
          </tr>
        </tbody>
      </table>

      <h2 className="section-title">プランを選ぶ</h2>

      <ul className="list">
        {plans.map((p) => (
          <li key={p.id}>
            <Link to={`/plans/${p.id}`} state={{ from }} viewTransition className="row">
              <div className="row-body">
                <div className="row-name">{p.name}</div>
                {/* M8：1か月あたりの値段も出す（長い期間が得かを、計算しなくて済む） */}
                <div className="row-sub">
                  {p.price.toLocaleString()}円
                  {p.months > 1 && `（1か月あたり 約${Math.round(p.price / p.months).toLocaleString()}円）`}
                </div>
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
