import { useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from './components/Button'

// レガシー版（M2。#196）。新しいパスワードを決める（/reset-password/<再設定用の文字>）。再設定のメールのリンクから来る。
// 確かめるのは画面だけ（長さ・2回が同じか）。API は確かめないので、API を直接呼べば、1文字でも通る
export default function ResetPasswordPage() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [shown, setShown] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    // 登録の画面に書いた決まりを、ここにもコピーした
    if (password.length < 8 || password.length > 64) {
      setError('パスワードは、8〜64文字にしてください')
      return
    }
    if (password !== again) {
      setError('パスワードが、2回で違っています')
      return
    }
    setSending(true)
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/password-resets/${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password }),
    })
    setSending(false)
    if (res.ok) {
      setDone(true)
    } else if (res.status === 404) {
      setError('再設定のリンクが正しくありません。もう一度、メールを送り直してください')
    } else {
      setError('変えられませんでした')
    }
  }

  return (
    <div className="auth">
      <div className="brand">
        <div className="logo logo-large">matching</div>
      </div>
      <div className="card">
        <h1 className="title">新しいパスワード</h1>
        {done ? (
          <>
            <p className="success">パスワードを変えました</p>
            <p className="verify-text">新しいパスワードで、ログインしてください。</p>
            <Link className="button" to="/login">
              ログインへ
            </Link>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <label className="label">
              新しいパスワード
              <input
                className="input"
                type={shown ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="hint">8〜64文字</span>
            </label>
            <label className="label">
              新しいパスワード（もう一度）
              <input
                className="input"
                type={shown ? 'text' : 'password'}
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
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
            <Button type="submit" loading={sending}>
              パスワードを変える
            </Button>
            <p className="muted">
              <Link to="/forgot-password">メールを送り直す</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
