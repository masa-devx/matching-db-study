import { useState } from 'react'
import Button from './components/Button'
import { Link } from 'react-router'

// レガシー版（03b）。入力の項目ごとに useState を並べ、確かめはしない（API も確かめないので、何でも通る）
export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('female')
  const [birthday, setBirthday] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  // 03c：送っている間はボタンにスピナーを出し、押せなくする（FR-UI-026）
  const [sending, setSending] = useState(false)

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    setSending(true)
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password, nickname, gender, birthday }),
    })
    setSending(false)
    if (res.status === 201) {
      setDone(true)
    } else {
      // 項目ごとの誤り（422 の errors）は見ない。同じメールアドレスは 500 になるので、何が違うかは分からない
      setError('登録できませんでした')
    }
  }

  if (done) {
    return (
      <div className="card">
        <h1 className="title">登録</h1>
        <p className="success">確認のメールを送りました</p>
        <p className="muted">
          <Link to="/login">ログインへ</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="auth">
      <div className="brand">
        <div className="logo logo-large">matching</div>
        <p className="brand-text">気になる人に、いいねを送ろう</p>
      </div>
      <div className="card">
        <h1 className="title">登録</h1>
        <form onSubmit={submit}>
          <label className="label">
            メールアドレス
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="label">
            パスワード
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="label">
            ニックネーム
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </label>
          <label className="label">
            性別
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
          </label>
          <label className="label">
            生年月日
            <input className="input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <Button type="submit" loading={sending}>
            登録する
          </Button>
        </form>
        <p className="muted">
          登録済みの方は <Link to="/login">ログイン</Link>
        </p>
      </div>
    </div>
  )
}
