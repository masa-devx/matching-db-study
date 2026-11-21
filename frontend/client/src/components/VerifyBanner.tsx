import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { apiFetch, apiFetchWithoutLogin } from '../shared/api/client'
import { useSession } from '../shared/session/SessionProvider'
import { useToast } from './Toast'

// M2（#193）：メールアドレスを確認していない会員に、どの画面でも、確認をうながす帯を出す（FR-UI-014）。
// 確認していないと、ほかの会員の検索に出ない。本人は使えているつもりなので、いいねが来ない理由に気づけなかった。
// 画面が変わるたびに、/api/me を読んで確かめる（タブのバッジとは別に、ここでももう1本呼ぶ）
export default function VerifyBanner() {
  const [me, setMe] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const location = useLocation()
  const toast = useToast()
  const { session, retry } = useSession()
  const sessionSaysUnverified = session.status === 'signedIn' && !session.account.emailVerified

  useEffect(() => {
    apiFetch(`/api/me`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then(setMe)
  }, [location.pathname])

  // #263：別のタブで確認のリンクを開いたあと、ここで確認済みと分かったら、Session を読み直す（タブのバーの数やお知らせが出るように）
  useEffect(() => {
    if (me?.email_verified_at && sessionSaysUnverified) retry()
  }, [me, sessionSaysUnverified, retry])

  // 読み終わるまでと、確認済みの会員には、何も出さない
  if (!me || !me.email || me.email_verified_at) return null

  // 確認のメールをもう一度送る（設定・登録の画面に書いた送り方を、ここにもコピーした）
  const resend = () => {
    setSending(true)
    apiFetchWithoutLogin(`/api/email-verifications`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: me.email }),
    }).then((r) => {
      setSending(false)
      toast(r.ok ? '確認のメールを送りました' : '送れませんでした', r.ok ? undefined : 'error')
    })
  }

  return (
    <div className="verify-banner" role="status">
      <p>メールアドレスが未確認です。確認すると、機能を使えるようになります。</p>
      <button type="button" className="button button-small button-ghost" disabled={sending} onClick={resend}>
        もう一度送る
      </button>
    </div>
  )
}
