import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import ConfirmDialog from './components/ConfirmDialog'
import Icon from './components/Icon'
import { useToast } from './components/Toast'
import { apiFetch, apiFetchForLogout, apiFetchWithoutLogin } from './shared/api/client'
import { useSession } from './shared/session/SessionProvider'

// レガシー版（M1。#181）。設定（/settings）。ホームの右上の歯車から来る。
// アカウント（メールアドレスの確認・パスワード）・有料会員・検索・安全・案内・ログアウト・退会を、ここにまとめる。
// ログアウトと退会の処理は、ホーム（HomePage）にあったものを、そのまま持ってきた。取る・送る・見せるを、全部この部品に書く
export default function SettingsPage() {
  const [me, setMe] = useState<any>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const { signOut } = useSession()
  // 確認のメールをもう一度送る
  const [resending, setResending] = useState(false)
  // パスワードを変えるモーダル
  const [changing, setChanging] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [changeError, setChangeError] = useState('')
  const [changeBusy, setChangeBusy] = useState(false)
  // ログアウト・退会（ホームから持ってきた）
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [password, setPassword] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  useEffect(() => {
    // ホームと同じ2本（自分・自分のプロフィール）を、ここにも書いた。メールアドレス・確認済みか・性別・有料かを知るため
    const headers = { Accept: 'application/json' }
    apiFetch(`/api/me`, { headers })
      .then((r) => r.json())
      .then((u) => apiFetch(`/api/users/${u.public_id}`, { headers }))
      .then((r) => r.json())
      .then((u) => setMe(u))
  }, [])

  // 確認のメールをもう一度送る（FR-AUTH-007 の API。ログインしていなくても呼べる API に、自分のメールアドレスを送る）
  const resend = () => {
    setResending(true)
    apiFetchWithoutLogin(`/api/email-verifications`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: me.email }),
    }).then((r) => {
      setResending(false)
      toast(r.ok ? '確認のメールを送りました' : '送れませんでした', r.ok ? undefined : 'error')
    })
  }

  // パスワードを変える。画面で確かめるのは、空でないことと、2回が同じことだけ（長さは見ない。API も見ない）
  const changePassword = () => {
    if (!current || !next) {
      setChangeError('今のパスワードと、新しいパスワードを入れてください')
      return
    }
    if (next !== again) {
      setChangeError('新しいパスワードが、2回で違っています')
      return
    }
    setChangeBusy(true)
    apiFetch(`/api/me/password`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ current_password: current, password: next }),
    }).then((r) => {
      setChangeBusy(false)
      if (r.status === 422) {
        setChangeError('今のパスワードがちがいます')
        return
      }
      if (!r.ok) {
        setChangeError('変えられませんでした')
        return
      }
      setChanging(false)
      toast('パスワードを変えました')
    })
  }

  const logout = () => {
    // ホームにあった処理を、そのまま持ってきた
    apiFetchForLogout(`/api/auth/logout`, {
      method: 'POST',
    })
    // 応答を待たずに消す。サーバーは何もしないので、消す前にコピーしたトークンは30日使える
    signOut()
    navigate('/login')
  }

  // 06：退会する。422 のときだけ、モーダルの中に出す（ほかの失敗は考えない）
  const withdraw = async () => {
    setWithdrawBusy(true)
    const res = await apiFetch(`/api/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ password }),
    })
    setWithdrawBusy(false)
    if (res.status === 422) {
      setWithdrawError('パスワードがちがいます')
      return
    }
    signOut()
    navigate('/login')
  }

  // 行の右の「>」。アイコンの back を、左右にひっくり返して使う
  const chevron = (
    <span className="settings-chevron">
      <Icon name="back" size={16} />
    </span>
  )

  return (
    <div>
      <div className="search-head">
        <h1 className="page-title">設定</h1>
        <Link className="button button-small button-ghost" to="/home" viewTransition>
          戻る
        </Link>
      </div>

      <h2 className="settings-title">アカウント</h2>
      <div className="settings-list">
        <div className="settings-row">
          <span className="settings-main">
            メールアドレス
            <span className="settings-sub">{me ? me.email : '　'}</span>
          </span>
          {/* 読み終わるまでは、印を出さない（先に「未確認」を出すと、確認済みの人にも一瞬見える） */}
          {me && me.email_verified_at && <span className="settings-ok">確認済み</span>}
          {me && !me.email_verified_at && <span className="settings-warn">未確認</span>}
        </div>
        {me && !me.email_verified_at && (
          <div className="settings-notice">
            <p>メールアドレスを確認すると、機能を使えるようになります。届いたメールのリンクを開いてください。</p>
            <button type="button" className="button button-ghost" disabled={resending} onClick={resend}>
              確認のメールをもう一度送る
            </button>
          </div>
        )}
        <button
          type="button"
          className="settings-row"
          onClick={() => {
            setCurrent('')
            setNext('')
            setAgain('')
            setChangeError('')
            setChanging(true)
          }}
        >
          <span className="settings-main">パスワードを変える</span>
          {chevron}
        </button>
      </div>

      {/* 07：有料会員は、男性にだけ出す。状態は is_paid だけを見る（期限が過ぎていても「有料会員」。ホームと同じ判断を、ここにも書いた） */}
      {me?.profile?.gender === 'male' && (
        <>
          <h2 className="settings-title">有料会員</h2>
          <div className="settings-list">
            <Link to="/plans" viewTransition className="settings-row">
              <span className="settings-main">
                {me.is_paid ? '有料会員' : '無料会員'}
                <span className="settings-sub">
                  {me.is_paid
                    ? `${new Date(me.paid_until).toLocaleDateString('ja-JP')} まで`
                    : 'プランを見る・有料会員になる'}
                </span>
              </span>
              {chevron}
            </Link>
          </div>
        </>
      )}

      {/* M3（#184）：送ったいいねの一覧は、いいねのタブから、ここに移した */}
      <h2 className="settings-title">いいね</h2>
      <div className="settings-list">
        <Link to="/likes/sent" viewTransition className="settings-row">
          <span className="settings-main">
            送ったいいね
            <span className="settings-sub">自分がいいねした相手を見る</span>
          </span>
          {chevron}
        </Link>
      </div>

      <h2 className="settings-title">検索</h2>
      <div className="settings-list">
        <Link to="/search/conditions" viewTransition className="settings-row">
          <span className="settings-main">
            保存した検索条件
            <span className="settings-sub">名前を直す・条件を直す・消す</span>
          </span>
          {chevron}
        </Link>
      </div>

      <h2 className="settings-title">安全</h2>
      <div className="settings-list">
        <Link to="/blocks" viewTransition className="settings-row">
          <span className="settings-main">ブロックした相手</span>
          {chevron}
        </Link>
        <Link to="/info/safety" viewTransition className="settings-row">
          <span className="settings-main">安全に使うために</span>
          {chevron}
        </Link>
      </div>

      <h2 className="settings-title">案内</h2>
      <div className="settings-list">
        <Link to="/info/help" viewTransition className="settings-row">
          <span className="settings-main">ヘルプ</span>
          {chevron}
        </Link>
        <Link to="/info/terms" viewTransition className="settings-row">
          <span className="settings-main">利用規約</span>
          {chevron}
        </Link>
        <Link to="/info/privacy" viewTransition className="settings-row">
          <span className="settings-main">プライバシーポリシー</span>
          {chevron}
        </Link>
      </div>

      <h2 className="settings-title">そのほか</h2>
      <div className="settings-list">
        <button type="button" className="settings-row" onClick={() => setConfirmLogout(true)}>
          <span className="settings-main">ログアウト</span>
        </button>
        <button
          type="button"
          className="settings-row settings-danger"
          onClick={() => {
            setPassword('')
            setWithdrawError('')
            setWithdrawing(true)
          }}
        >
          <span className="settings-main">退会する</span>
        </button>
      </div>

      <ConfirmDialog
        open={changing}
        title="パスワードを変える"
        confirmLabel="変える"
        busy={changeBusy}
        onConfirm={changePassword}
        onClose={() => setChanging(false)}
      >
        <label className="label">
          今のパスワード
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="label">
          新しいパスワード（8〜64文字）
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className="label">
          新しいパスワード（もう一度）
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </label>
        {changeError && <p className="modal-error">{changeError}</p>}
      </ConfirmDialog>

      {/* 03c：ログアウトの前に確かめる（FR-UI-023） */}
      <ConfirmDialog
        open={confirmLogout}
        title="ログアウトしますか？"
        confirmLabel="ログアウトする"
        danger
        onConfirm={logout}
        onClose={() => setConfirmLogout(false)}
      />

      {/* 06：退会の確かめ（部品の確認のモーダルに、パスワードの入力を入れる） */}
      <ConfirmDialog
        open={withdrawing}
        title="退会しますか？"
        confirmLabel="退会する"
        danger
        busy={withdrawBusy}
        onConfirm={withdraw}
        onClose={() => setWithdrawing(false)}
      >
        <p>同じメールアドレスで、あとから登録し直せます。今のマッチやメッセージは引き継げません。</p>
        <label className="label">
          パスワード
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {withdrawError && <p className="modal-error">{withdrawError}</p>}
      </ConfirmDialog>
    </div>
  )
}
