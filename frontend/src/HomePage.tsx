import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import Button from './components/Button'
import ConfirmDialog from './components/ConfirmDialog'
import { SkeletonProfile } from './components/Skeleton'
import { useToast } from './components/Toast'

// レガシー版（03b）。ホーム（/home）＝自分のプロフィールを見て直す。全部この部品に書く
export default function HomePage(props: any) {
  const [me, setMe] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)
  // 03c：保存の結果はトーストで出す（FR-UI-024）。ログアウトは確認のモーダルを通す（FR-UI-023）
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  // 06：退会のモーダル（開いているか・入れたパスワード・失敗の文）
  const [withdrawing, setWithdrawing] = useState(false)
  const [password, setPassword] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、画面ごとに書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗・401 は考えない（StrictMode なので、開発中は2本ずつ呼ばれる）
    // 自分の public_id（#46）を知るために /api/me を呼び、そのあとプロフィールを呼ぶ（2本が順に流れる）
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then((u) =>
        fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users/${u.public_id}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        }),
      )
      .then((r) => r.json())
      .then((u) => {
        setMe(u)
        setForm(u.profile ?? {})
      })
  }, [])

  const logout = () => {
    // 送り先とトークンの読み出しを、ここにも書く
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
    // 応答を待たずに消す。サーバーは何もしないので、消す前に写したトークンは30日使える
    sessionStorage.removeItem('token')
    props.setToken(null)
    navigate('/login')
  }

  // 06：退会する。422 のときだけ、モーダルの中に出す（ほかの失敗は考えない）
  const withdraw = async () => {
    setWithdrawBusy(true)
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
      },
      body: JSON.stringify({ password }),
    })
    setWithdrawBusy(false)
    if (res.status === 422) {
      setWithdrawError('パスワードがちがいます')
      return
    }
    // ログアウトと同じく、画面のトークンを消すだけ（サーバーはトークンを止めないので、写したものは使える）
    sessionStorage.removeItem('token')
    props.setToken(null)
    navigate('/login')
  }

  const save = async (e: any) => {
    e.preventDefault()
    setSaving(true)
    // 入力を確かめない。API も確かめないので、何でも入る
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users/${me.public_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        nickname: form.nickname,
        prefecture: form.prefecture,
        height: form.height,
        introduction: form.introduction,
        image: form.image,
      }),
    })
    const profile = await res.json()
    setSaving(false)
    setMe({ ...me, profile })
    setEditing(false)
    // 失敗（500 など）は考えない。いつも「保存しました」と出る（FR-UI-013 はまだ守れていない）
    toast('保存しました')
  }

  // 年齢の計算を、相手の画面からここにも写した（誕生日の前だと1歳多い）
  const age = me?.profile?.birthday ? new Date().getFullYear() - Number(me.profile.birthday.slice(0, 4)) : ''
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  // 03c：読み込み中は、中身と同じ形のスケルトン（FR-UI-025）
  if (!me) return <SkeletonProfile />

  return (
    <div className="profile">
      <div className="me-head">
        <span className="me-avatar">
          <Avatar image={me.profile?.image} name={me.profile?.nickname} size={120} />
        </span>
        <div className="photo-name me-name">
          {me.profile?.nickname} <span className="photo-age">{age}歳</span>
        </div>
        <div className="muted-text">{me.email}</div>
      </div>

      <div className="profile-body">
        {!editing ? (
          <>
            <div className="chips">
              {me.profile?.prefecture && <span className="chip">{me.profile.prefecture}</span>}
              {me.profile?.height && <span className="chip">{me.profile.height}cm</span>}
            </div>
            <div className="card">
              <h2 className="section-title">自己紹介</h2>
              <p className="intro">{me.profile?.introduction || 'まだ書いていません'}</p>
            </div>
            <Button onClick={() => setEditing(true)}>プロフィールを編集</Button>
          </>
        ) : (
          <form className="card" onSubmit={save}>
            <h2 className="section-title">プロフィールを編集</h2>
            <div className="label">写真</div>
            <div className="avatar-picker">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <label key={n} className={form.image === `/images/avatars/demo-${n}.svg` ? 'pick pick-on' : 'pick'}>
                  <input
                    type="radio"
                    name="image"
                    value={`/images/avatars/demo-${n}.svg`}
                    checked={form.image === `/images/avatars/demo-${n}.svg`}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                  />
                  <img src={`${api}/images/avatars/demo-${n}.svg`} />
                </label>
              ))}
            </div>
            <label className="label">
              ニックネーム
              <input
                className="input"
                value={form.nickname ?? ''}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
            </label>
            <label className="label">
              都道府県
              <input
                className="input"
                value={form.prefecture ?? ''}
                onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
              />
            </label>
            <label className="label">
              身長（cm）
              <input
                className="input"
                value={form.height ?? ''}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
              />
            </label>
            <label className="label">
              自己紹介
              <textarea
                className="input"
                rows={5}
                value={form.introduction ?? ''}
                onChange={(e) => setForm({ ...form, introduction: e.target.value })}
              />
            </label>
            <Button type="submit" loading={saving}>
              保存する
            </Button>
            <Button variant="ghost" className="button-space" onClick={() => setEditing(false)}>
              やめる
            </Button>
          </form>
        )}
      </div>
      {/* 07：有料会員の入口は、男性にだけ出す。状態は is_paid だけを見る（期限が過ぎていても「有料会員」） */}
      {me.profile?.gender === 'male' && (
        <Link to="/plans" viewTransition className="button button-ghost logout">
          {me.is_paid ? `有料会員（${new Date(me.paid_until).toLocaleDateString('ja-JP')} まで）` : '有料会員になる'}
        </Link>
      )}
      <Link to="/blocks" viewTransition className="button button-ghost logout">
        ブロックした相手
      </Link>
      <Button variant="ghost" className="logout" onClick={() => setConfirmLogout(true)}>
        ログアウト
      </Button>
      <button
        className="danger-link"
        onClick={() => {
          setPassword('')
          setWithdrawError('')
          setWithdrawing(true)
        }}
      >
        退会する
      </button>

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
