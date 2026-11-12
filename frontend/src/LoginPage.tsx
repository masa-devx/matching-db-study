import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

// レガシー版（03b）。送る・トークンを置く・失敗を見せる・移るを、この部品にまとめて書く
export default function LoginPage(props: any) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    // 送り先は画面ごとに書く。つながらないとき（API が止まっている）は、例外のまま何も出ない
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (res.ok) {
      // XSS があると、画面で動いたスクリプトがここから持ち出せる
      sessionStorage.setItem('token', data.token)
      props.setToken(data.token)
      navigate('/home')
    } else {
      // API の言葉をそのまま出す（「メールアドレスが違います」で、登録されているかが分かる）
      setError(data.message)
    }
  }

  return (
    <div className="card">
      <h1 className="title">ログイン</h1>
      <form onSubmit={submit}>
        <label className="label">
          メールアドレス
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="label">
          パスワード
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button" type="submit">
          ログイン
        </button>
      </form>
      <p className="muted">
        はじめての方は <Link to="/register">登録</Link>
      </p>
    </div>
  )
}
