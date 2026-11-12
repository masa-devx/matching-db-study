import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

// レガシー版（03b）。ホーム（/home）＝自分のプロフィールを見て直す。全部この部品に書く
export default function HomePage() {
  const [me, setMe] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、画面ごとに書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗・401 は考えない（StrictMode なので、開発中は2本ずつ呼ばれる）
    // 自分の id を知るために /api/me を呼び、そのあとプロフィールを呼ぶ（2本が順に流れる）
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then((u) =>
        fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users/${u.id}/profile`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        }),
      )
      .then((r) => r.json())
      .then((u) => {
        setMe(u)
        setForm(u.profile ?? {})
      })
  }, [])

  const save = async (e: any) => {
    e.preventDefault()
    // 入力を確かめない。API も確かめないので、何でも入る
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users/${me.id}/profile`, {
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
    setMe({ ...me, profile })
    setEditing(false)
    setMessage('保存しました')
  }

  // 年齢の計算を、相手の画面からここにも写した（誕生日の前だと1歳多い）
  const age = me?.profile?.birthday ? new Date().getFullYear() - Number(me.profile.birthday.slice(0, 4)) : ''
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  if (!me) return null

  return (
    <div className="profile">
      <div className="me-head">
        {me.profile?.image ? (
          <img className="me-avatar" src={`${api}${me.profile.image}`} />
        ) : (
          <div className="me-avatar me-avatar-empty">?</div>
        )}
        <div className="photo-name me-name">
          {me.profile?.nickname} <span className="photo-age">{age}歳</span>
        </div>
        <div className="muted-text">{me.email}</div>
      </div>

      {message && <p className="toast">{message}</p>}

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
          <button
            className="button"
            onClick={() => {
              setMessage('')
              setEditing(true)
            }}
          >
            プロフィールを編集
          </button>
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
          <button className="button" type="submit">
            保存する
          </button>
          <button className="button button-ghost button-space" type="button" onClick={() => setEditing(false)}>
            やめる
          </button>
        </form>
      )}
    </div>
  )
}
