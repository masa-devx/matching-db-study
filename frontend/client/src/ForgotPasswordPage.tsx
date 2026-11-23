import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from './api/ApiError'
import { authApi } from './api/authApi'
import Button from './components/Button'

// レガシー版（M2。#196）。パスワードを忘れたとき（/forgot-password）。ログインの画面から来る。
// メールアドレスを入れると、再設定のメールを送る。送る・結果を見せるを、この部品にまとめて書く
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    if (!email) {
      setError('メールアドレスを入れてください')
      return
    }
    setSending(true)
    try {
      await authApi.requestPasswordReset(email)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      setSending(false)
      if (e.status === 404) {
        // API の答えを、そのまま伝える（このメールアドレスが登録されているかどうかが、だれにでも分かる）
        setError('このメールアドレスは、登録されていません')
      } else {
        setError('送れませんでした')
      }
      return
    }
    setSending(false)
    setDone(true)
  }

  return (
    <div className="auth">
      <div className="brand">
        <div className="logo logo-large">matching</div>
      </div>
      <div className="card">
        <h1 className="title">パスワードの再設定</h1>
        {done ? (
          <>
            <p className="success">再設定のメールを送りました</p>
            <p className="verify-text">
              <strong className="verify-email">{email}</strong>{' '}
              に送りました。メールの中のリンクを開いて、新しいパスワードを決めてください。
            </p>
            <p className="muted">
              <Link to="/login">ログインへ戻る</Link>
            </p>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="verify-text">登録したメールアドレスを入れてください。再設定のためのメールを送ります。</p>
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
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={sending}>
              メールを送る
            </Button>
            <p className="muted">
              <Link to="/login">ログインへ戻る</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
