import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from './api/ApiError'
import { authApi } from './api/authApi'
import { useSession } from './shared/session/SessionProvider'

// レガシー版（M2。#193）。メールアドレスの確認の画面（/verify/<確認用の文字>）。確認のメールのリンクから来る。
// 前は、リンクが API を直接開き、JSON の文字だけが出ていた。ここで API を呼び、結果と、次にやることを出す。
// ログインしていなくても開ける（メールを開いた端末が、登録した端末とは限らない）
export default function VerifyPage() {
  const { session } = useSession()
  const { token } = useParams()
  // 結果：null は確かめている途中、true は確認できた、false はリンクが正しくない
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    // 開いたら、すぐ確認の API を呼ぶ（つながらないときは、「確かめています」のまま止まる）
    authApi.verifyEmail(token ?? '').then(
      () => setOk(true),
      (e) => {
        if (!(e instanceof ApiError)) throw e
        setOk(false)
      },
    )
  }, [token])

  const loggedIn = session.status === 'signedIn'

  return (
    <div className="auth">
      <div className="brand">
        <div className="logo logo-large">matching</div>
      </div>
      <div className="card">
        <h1 className="title">メールアドレスの確認</h1>
        {ok === null && <p className="muted">確かめています…</p>}
        {ok === true && (
          <>
            <p className="success">メールアドレスを確認しました</p>
            <p className="verify-text">これで、機能を使えるようになります。</p>
            <Link className="button" to={loggedIn ? '/home' : '/login'}>
              {loggedIn ? 'ホームへ' : 'ログインへ'}
            </Link>
          </>
        )}
        {ok === false && (
          <>
            <p className="error">確認のリンクが正しくありません</p>
            <p className="verify-text">
              リンクが途中で切れていないか、確かめてください。ログインして、設定の「アカウント」から、確認のメールをもう一度送れます。
            </p>
            <Link className="button" to={loggedIn ? '/settings' : '/login'}>
              {loggedIn ? '設定へ' : 'ログインへ'}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
