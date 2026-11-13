import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

// レガシー版（04）。検索のタブ（/search）＝条件で相手を探して、2列のカードで見る。
// 条件・取る・続き・見せるを、全部この部品に書く（03b と同じ形）。

// 都道府県の名前を、ここに書き写す（API もホームの入力も、名前の文字で持つ）
const PREFECTURES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
]

export default function SearchPage() {
  // 条件は sessionStorage に置く。相手のプロフィールから戻ると、部品が作り直されるため（FR-UI-016）
  const [conditions, setConditions] = useState<any>(JSON.parse(sessionStorage.getItem('searchConditions') ?? '{}'))
  const [form, setForm] = useState<any>(conditions)
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  // 07：自分が男性の無料の会員か（身長の条件を使えない）と、誘導のモーダル
  const [locked, setLocked] = useState(false)
  const [upsell, setUpsell] = useState(false)
  const navigate = useNavigate()

  // 1ページ分を取って、今の一覧の後ろに足す。重なっていても、そのまま足す
  const load = (p: number, c: any) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (c.gender) params.append('gender', c.gender)
    if (c.age_min) params.append('age_min', c.age_min)
    if (c.age_max) params.append('age_max', c.age_max)
    if (c.height_min) params.append('height_min', c.height_min)
    if (c.height_max) params.append('height_max', c.height_max)
    for (const pref of c.prefecture ?? []) params.append('prefecture[]', pref)
    params.append('page', String(p))
    // 読み込み中・失敗・401 は考えない
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => {
        // 07：身長の条件を残したまま無料になったときなど、API が 403 を返したら、モーダルを出して空にする
        if (r.status === 403) {
          setUpsell(true)
          return []
        }
        return r.json()
      })
      .then((rows) => {
        setUsers((before) => (p === 1 ? rows : [...before, ...rows]))
        setPage(p)
        // 20人より少なければ、もういない（ちょうど20人で終わると、空のページをもう1回読む）
        setDone(rows.length < 20)
        setLoading(false)
      })
  }

  useEffect(() => {
    // ログインが要るかの守りを、ここにも書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 戻ってくるたびに、1ページ目から読み直す（どこまで見ていたかは覚えない）
    load(1, conditions)
  }, [conditions])

  useEffect(() => {
    // 07：男性の無料の会員かを知るために、自分と自分のプロフィールを読む（ホームと同じ2本を、ここにも写す）
    const headers = { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` }
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me`, { headers })
      .then((r) => r.json())
      .then((u) =>
        fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users/${u.public_id}`, { headers }),
      )
      .then((r) => r.json())
      .then((u) => setLocked(u.profile?.gender === 'male' && !u.is_paid))
  }, [])

  useEffect(() => {
    // スクロールするのは枠の中（.frame-main）なので、その要素を探して見張る
    const box = document.querySelector('.frame-main')
    if (!box) return
    const onScroll = () => {
      // 下から 200px まで来たら、続きを読む。loading は描き直すまで変わらないので、続けて何本も呼ぶことがある
      if (!loading && !done && box.scrollTop + box.clientHeight >= box.scrollHeight - 200) {
        load(page + 1, conditions)
      }
    }
    box.addEventListener('scroll', onScroll)
    return () => box.removeEventListener('scroll', onScroll)
  }, [page, loading, done, conditions])

  const togglePref = (pref: string) => {
    const now = form.prefecture ?? []
    setForm({ ...form, prefecture: now.includes(pref) ? now.filter((x: string) => x !== pref) : [...now, pref] })
  }

  const apply = (e: any) => {
    e.preventDefault()
    // 入力を確かめない。年齢の下が上より大きくても、そのまま送る
    sessionStorage.setItem('searchConditions', JSON.stringify(form))
    setConditions(form)
    setOpen(false)
    document.querySelector('.frame-main')?.scrollTo(0, 0)
  }

  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  return (
    <div>
      <div className="search-head">
        <h1 className="page-title">さがす</h1>
        <button className="button button-small button-ghost" onClick={() => setOpen(!open)}>
          {open ? '閉じる' : '絞り込み'}
        </button>
      </div>

      {open && (
        <form className="card search-form" onSubmit={apply}>
          <label className="label">
            性別
            <select
              className="input"
              value={form.gender ?? ''}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">自分と違う性別</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </label>
          <div className="search-range">
            <label className="label">
              年齢（下）
              <input
                className="input"
                type="number"
                value={form.age_min ?? ''}
                onChange={(e) => setForm({ ...form, age_min: e.target.value })}
              />
            </label>
            <label className="label">
              年齢（上）
              <input
                className="input"
                type="number"
                value={form.age_max ?? ''}
                onChange={(e) => setForm({ ...form, age_max: e.target.value })}
              />
            </label>
          </div>
          {/* 07：男性の無料の会員には、身長の条件に「有料」の印を出し、押すとモーダル */}
          {locked && (
            <button type="button" className="paid-lock" onClick={() => setUpsell(true)}>
              身長で探す <span className="paid-mark">有料</span>
            </button>
          )}
          <div className={locked ? 'search-range hidden-range' : 'search-range'}>
            <label className="label">
              身長（下）
              <input
                className="input"
                type="number"
                value={form.height_min ?? ''}
                onChange={(e) => setForm({ ...form, height_min: e.target.value })}
              />
            </label>
            <label className="label">
              身長（上）
              <input
                className="input"
                type="number"
                value={form.height_max ?? ''}
                onChange={(e) => setForm({ ...form, height_max: e.target.value })}
              />
            </label>
          </div>
          <p className="label">都道府県（選ばなければ全国）</p>
          <div className="pref-list">
            {PREFECTURES.map((pref) => (
              <button
                type="button"
                key={pref}
                className={(form.prefecture ?? []).includes(pref) ? 'chip chip-on' : 'chip'}
                onClick={() => togglePref(pref)}
              >
                {pref}
              </button>
            ))}
          </div>
          <button className="button">この条件で探す</button>
        </form>
      )}

      {!loading && users.length === 0 && (
        <div className="soon">
          <p>条件に合う相手がいません</p>
          <button className="button button-small" onClick={() => setOpen(true)}>
            条件を変える
          </button>
        </div>
      )}

      <ul className="user-grid">
        {users.map((u) => (
          // 続きで同じ人が2回来ると、key が重なる（React が警告を出す）
          <li key={u.public_id}>
            <Link to={`/users/${u.public_id}`} className="user-card">
              {u.profile?.image ? (
                <img className="photo-img" src={`${api}${u.profile.image}`} />
              ) : (
                <div className="photo-empty">写真なし</div>
              )}
              <div className="user-card-caption">
                <div className="user-card-name">
                  {u.profile?.nickname} {/* 年齢の計算を、また写した（誕生日の前だと1歳多い） */}
                  {u.profile?.birthday && (
                    <span>{new Date().getFullYear() - Number(u.profile.birthday.slice(0, 4))}歳</span>
                  )}
                </div>
                <div className="user-card-sub">{u.profile?.prefecture}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {loading && <p className="soon">読み込み中…</p>}
      {done && users.length > 0 && <p className="soon">これで全員です</p>}
      {upsell && (
        // 07：誘導のモーダル（送る・検索・いいねの画面に、同じものを書く）
        <div className="modal-back" onClick={() => setUpsell(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">有料会員になると使えます</p>
            <p>メッセージを送る・いいねを何回でも・身長で探す、が使えるようになります。</p>
            <button className="button" onClick={() => navigate('/plans')}>
              有料会員になる
            </button>
            <button className="button button-ghost" onClick={() => setUpsell(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
