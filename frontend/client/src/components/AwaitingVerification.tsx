import { useState } from 'react'
import { useNavigate } from 'react-router'
import { apiFetchWithoutLogin } from '../shared/api/client'
import { useSession } from '../shared/session/SessionProvider'
import { useLogout } from '../shared/session/useLogout'
import Button from './Button'
import { useToast } from './Toast'

// #263：メールアドレスを確認していない会員に、ログインが要る画面の代わりに出す（FR-AUTH-021・FR-UI-014）。
// 機能の API は 403 で断られるので、画面ごとに読み込み中のまま止めず、ここ1か所で案内する。
// 理由は本人にだけ見せる（ログインした人だけが、この画面を開ける）
export default function AwaitingVerification({ email }: { email: string }) {
  const { retry } = useSession()
  const { logout: logoutFromServer, loggingOut } = useLogout()
  const [sending, setSending] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const resend = async () => {
    setSending(true)
    try {
      const res = await apiFetchWithoutLogin('/api/email-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      toast(res.ok ? '確認のメールを送りました' : '送れませんでした', res.ok ? undefined : 'error')
    } catch {
      toast('送れませんでした', 'error')
    } finally {
      setSending(false)
    }
  }

  // 手順は shared/session/useLogout（ホーム・設定の画面と同じ）
  const logout = async () => {
    if (await logoutFromServer()) {
      navigate('/login')
      return
    }
    toast('ログアウトできませんでした。もう一度お試しください', 'error')
  }

  return (
    <div className="empty" role="status">
      <p className="empty-text">この機能は使えません</p>
      <p className="verify-text">
        メールアドレスを確認すると、使えるようになります。{email} に届いたメールのリンクを開いてください。
      </p>
      <Button type="button" loading={sending} onClick={resend}>
        確認のメールをもう一度送る
      </Button>
      {/* 別のタブで確認のリンクを開いたあと、ここで読み直す */}
      <button type="button" className="button button-ghost" onClick={retry}>
        確認した
      </button>
      <button type="button" className="button button-ghost" onClick={logout} disabled={loggingOut}>
        ログアウト
      </button>
    </div>
  )
}
