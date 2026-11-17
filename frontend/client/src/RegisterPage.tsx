import { useState } from 'react'
import { Link } from 'react-router'
import Button from './components/Button'

// レガシー版（03b）。入力の項目ごとに useState を並べる。
// M2（#193）：入力の決まりを欄のそばに出し、パスワードの確かめ（2回目）・見せる切り替え・生年月日のプルダウン・
// 利用規約と18歳以上の確かめを足した。登録のあとの画面に、送り先・届かないときの案内・もう一度送るボタンを足した。
// 確かめるのは画面だけ（API は確かめないので、API を直接呼べば、何でも通る）

// 生年月日のプルダウンに出す年（18歳〜99歳になる年）
const THIS_YEAR = new Date().getFullYear()
const YEARS: number[] = []
for (let y = THIS_YEAR - 18; y >= THIS_YEAR - 99; y--) YEARS.push(y)
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const DAYS: number[] = []
for (let d = 1; d <= 31; d++) DAYS.push(d)

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [shown, setShown] = useState(false)
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState('female')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [adult, setAdult] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  // 03c：送っている間はボタンにスピナーを出し、押せなくする（FR-UI-026）
  const [sending, setSending] = useState(false)
  // M2：確認のメールをもう一度送ったあとの知らせ
  const [resent, setResent] = useState('')

  const submit = async (e: any) => {
    e.preventDefault()
    setError('')
    // M2：画面で確かめる（決まりは、要件 auth.md からここに書き写した）。どれか1つでも違えば、送らない
    if (!email || !password || !nickname || !year || !month || !day) {
      setError('まだ入れていない項目があります')
      return
    }
    if (password.length < 8 || password.length > 64) {
      setError('パスワードは、8〜64文字にしてください')
      return
    }
    if (password !== again) {
      setError('パスワードが、2回で違っています')
      return
    }
    if (nickname.length > 20) {
      setError('ニックネームは、20文字までにしてください')
      return
    }
    // 2月30日のような、ない日付を確かめる（Date に入れて、同じ日に戻るかを見る）
    const birthday = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    if (date.getMonth() !== Number(month) - 1) {
      setError('生年月日が、ない日付になっています')
      return
    }
    // 18歳以上か（誕生日がまだ来ていなければ、1つ引く）
    const now = new Date()
    const age =
      now.getFullYear() -
      date.getFullYear() -
      (now < new Date(now.getFullYear(), date.getMonth(), date.getDate()) ? 1 : 0)
    if (age < 18) {
      setError('18歳以上の方だけが登録できます')
      return
    }
    if (!agreed || !adult) {
      setError('利用規約への同意と、18歳以上で独身であることの確かめに、チェックを入れてください')
      return
    }
    setSending(true)
    // 同意したこと・確かめたことは、API に送らない（サーバーには、同意の記録が残らない）
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
      setError('登録できませんでした。メールアドレスが、もう登録されているかもしれません')
    }
  }

  // M2：確認のメールをもう一度送る（設定の画面に書いた送り方を、ここにもコピーした）
  const resend = () => {
    setResent('')
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/email-verifications`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then((r) => setResent(r.ok ? 'もう一度送りました' : '送れませんでした'))
  }

  if (done) {
    return (
      <div className="auth">
        <div className="brand">
          <div className="logo logo-large">matching</div>
        </div>
        <div className="card">
          <h1 className="title">確認のメールを送りました</h1>
          <p className="verify-text">
            <strong className="verify-email">{email}</strong> に、確認のメールを送りました。メールの中のリンクを開くと、登録が終わります。
          </p>
          <h2 className="section-title">メールが届かないとき</h2>
          <ul className="verify-list">
            <li>迷惑メールのフォルダに入っていないか、確かめてください</li>
            <li>上のメールアドレスが正しいか、確かめてください（違っていたら、もう一度登録してください）</li>
          </ul>
          <Button variant="ghost" onClick={resend}>
            確認のメールをもう一度送る
          </Button>
          {resent && (
            <p className="muted" role="status">
              {resent}
            </p>
          )}
          <p className="muted">
            <Link to="/login">ログインへ</Link>
          </p>
        </div>
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
        <form onSubmit={submit} noValidate>
          <label className="label">
            メールアドレス
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="hint">確認のメールを送ります。ほかの会員には見えません</span>
          </label>
          <label className="label">
            パスワード
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
            パスワード（もう一度）
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
          <label className="label">
            ニックネーム
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <span className="hint">20文字まで。ほかの会員に見えます</span>
          </label>
          <label className="label">
            性別
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
            <span className="hint">登録のあとは、変えられません</span>
          </label>
          {/* M2：生年月日は、年・月・日のプルダウン（カレンダーで何十年もさかのぼらなくて済む） */}
          <fieldset className="birthday">
            <legend className="label">生年月日</legend>
            <div className="birthday-row">
              <select className="input" aria-label="生まれた年" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">年</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
              <select className="input" aria-label="生まれた月" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">月</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
              <select className="input" aria-label="生まれた日" value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="">日</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
            </div>
            <span className="hint">18歳以上の方だけが登録できます。登録のあとは、変えられません。ほかの会員には、年齢だけが見えます</span>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            18歳以上で、独身です
          </label>
          <label className="check">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              <Link to="/info/terms" target="_blank">
                利用規約
              </Link>
              と
              <Link to="/info/privacy" target="_blank">
                プライバシーポリシー
              </Link>
              に同意します
            </span>
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
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
