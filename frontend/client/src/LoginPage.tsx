import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Button from './components/Button'

// レガシー版（03b）。送る・トークンを置く・失敗を見せる・移るを、この部品にまとめて書く。
// M2（#193）：パスワードを見せる切り替え・autocomplete・利用を止められたときの案内を足した
export default function LoginPage(props: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [shown, setShown] = useState(false)
  // M2：利用を止められた会員か（403）。理由は出せない（API が返さない）ので、問い合わせ先の案内だけを出す
  const [suspended, setSuspended] = useState(false)
  // 03c：送っている間はボタンにスピナーを出し、押せなくする（FR-UI-026）
  const [sending, setSending] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    setSuspended(false)
    setSending(true)
    // 送り先は画面ごとに書く。つながらないとき（API が止まっている）は、例外のまま何も出ない
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setSending(false)
    if (res.ok) {
      // XSS があると、画面で動いたスクリプトがここから持ち出せる
      sessionStorage.setItem('token', data.token)
      props.setToken(data.token)
      navigate('/home')
    } else {
      // API の言葉をそのまま出す（「メールアドレスが違います」で、登録されているかが分かる）
      setError(data.message)
      setSuspended(res.status === 403)
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
