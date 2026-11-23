import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from './api/ApiError'
import { authApi } from './api/authApi'
import Button from './components/Button'
import { useSession } from './shared/session/SessionProvider'
import { ACCOUNT_SUSPENDED_REASON, SIGNED_OUT_REASON } from './shared/session/session'

// レガシー版（03b）。送る・失敗を見せる・移るを、この部品にまとめて書く。
// M2（#193）：パスワードを見せる切り替え・autocomplete・利用を止められたときの案内を足した
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shown, setShown] = useState(false)
  // M2：利用を止められた会員か（403）。理由は出せない（API が返さない）ので、問い合わせ先の案内だけを出す
  const [suspended, setSuspended] = useState(false)
  // 03c：送っている間はボタンにスピナーを出し、押せなくする（FR-UI-026）
  const [sending, setSending] = useState(false)
  const navigate = useNavigate()
  const { signIn } = useSession()
  // #257：ログインしたあとの API が 401 を返して、ここへ移ってきたか（FR-UI-100）
  const [searchParams] = useSearchParams()
  const reason = searchParams.get('reason')
  const signedOut = reason === SIGNED_OUT_REASON
  const suspendedBefore = reason === ACCOUNT_SUSPENDED_REASON

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    setSuspended(false)
    setSending(true)
    // つながらないとき（API が止まっている）は、例外のまま何も出ない
    try {
      await authApi.login(email, password)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      setSending(false)
      // API の言葉をそのまま出す（「メールアドレスが違います」で、登録されているかが分かる）
      setError(e.serverMessage ?? '')
      // A7（#213）：強制退会（同じ 403）のときは、停止の案内を出さない。API の code で見分ける
      setSuspended(e.status === 403 && e.code === 'account_suspended')
      return
    }
    setSending(false)
    // トークンは受け取らない。セッションの Cookie は HttpOnly なので、画面のスクリプトから読めない（D-027）。
    // GET /api/me が通らなければ、Cookie が届いていない（127.0.0.1 で開いた・設定の漏れ）。何も出さずに戻さず、文を出す
    if (await signIn()) {
      navigate('/home')
    } else {
      setError('ログインできませんでした。画面を読み込み直してください')
    }
  }

  return (
    <div className="auth">
      <div className="brand">
        <div className="logo logo-large">matching</div>
        <p className="brand-text">気になる人に、いいねを送ろう</p>
      </div>
      <div className="card">
        <h1 className="title">ログイン</h1>
        {/* FR-UI-100：前の画面で 401 が返って移ってきたとき。題のすぐ下に出す（あとから気づけるように） */}
        {suspendedBefore && !error && (
          <p className="error" role="alert">
            ログインはできません。このアカウントは停止されています
          </p>
        )}
        {signedOut && !error && (
          <p className="verify-text" role="alert">
            ログインが切れました。もう一度ログインしてください
          </p>
        )}
        <form onSubmit={submit}>
          <label className="label">
            メールアドレス
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="label">
            パスワード
            <input
              className="input"
              type={shown ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
            パスワードを見せる
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {suspended && (
            <p className="verify-text">
              利用規約に合わない使い方が見つかったため、運営が利用を止めています。心当たりがないときは、運営にお問い合わせください（この学習用のアプリには、問い合わせの窓口はありません）。
            </p>
          )}
          <Button type="submit" loading={sending}>
            ログイン
          </Button>
        </form>
        {/* M2（#196）：パスワードを忘れたとき */}
        <p className="muted">
          <Link to="/forgot-password">パスワードを忘れた方</Link>
        </p>
        <p className="muted">
          はじめての方は <Link to="/register">登録</Link>
        </p>
      </div>
    </div>
  )
}
