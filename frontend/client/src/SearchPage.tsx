import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from './components/Button'
import ConfirmDialog from './components/ConfirmDialog'
import { SkeletonCards } from './components/Skeleton'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'

// レガシー版（04）。検索のタブ（/search）＝条件で相手を探して、2列のカードで見る。
// 条件・取る・続き・見せるを、全部この部品に書く（03b と同じ形）。
// 04b：今の条件を URL のクエリ（/search?age_min=20…）に出し、保存した検索条件（名前を付けて5件まで）もここに足した。

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

// 04b：URL のクエリを、条件の形に直す。値は確かめない（/search?age_min=abc も、そのまま API に送る）
const fromQuery = (q: URLSearchParams) => {
  const c: any = {}
  if (q.get('gender')) c.gender = q.get('gender')
  if (q.get('age_min')) c.age_min = q.get('age_min')
  if (q.get('age_max')) c.age_max = q.get('age_max')
  if (q.get('height_min')) c.height_min = q.get('height_min')
  if (q.get('height_max')) c.height_max = q.get('height_max')
  if (q.getAll('prefecture').length > 0) c.prefecture = q.getAll('prefecture')
  return c
}

// 04b：条件を URL のクエリに直す。API に送るクエリ（load の中）と、ほぼ同じものをもう一度書いた
const toQuery = (c: any) => {
  const q = new URLSearchParams()
  if (c?.gender) q.append('gender', c.gender)
  if (c?.age_min) q.append('age_min', c.age_min)
  if (c?.age_max) q.append('age_max', c.age_max)
  if (c?.height_min) q.append('height_min', c.height_min)
  if (c?.height_max) q.append('height_max', c.height_max)
  for (const pref of c?.prefecture ?? []) q.append('prefecture', pref)
  return q
}

export default function SearchPage() {
  // 04b：今の条件の正は、URL のクエリ。再読み込み・ブックマーク・「戻る」で同じ条件になる（FR-UI-041〜043）
  const [searchParams, setSearchParams] = useSearchParams()
  const conditions: any = fromQuery(searchParams)
  const [form, setForm] = useState<any>(conditions)
  // 04b：保存した検索条件（サーバーに5件まで）と、そのモーダル
  const [saved, setSaved] = useState<any[]>([])
  const [managing, setManaging] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  const toast = useToast()
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
    // 04b：URL にクエリがないとき（タブから /search を開いたとき）は、タブの中で覚えた最後の条件に戻す（FR-UI-016）。
    // 履歴を増やさないよう replace で入れ替える。入れ替えると、この useEffect がもう一度動く
    const last = JSON.parse(sessionStorage.getItem('searchConditions') ?? '{}')
    if (searchParams.toString() === '' && toQuery(last).toString() !== '') {
      setSearchParams(toQuery(last), { replace: true })
      return
    }
    // 「戻る」で URL が変わったときに、絞り込みの欄も合わせる
    setForm(conditions)
    // 戻ってくるたびに、1ページ目から読み直す（どこまで見ていたかは覚えない）
    load(1, conditions)
  }, [searchParams.toString()])

  // 04b：保存した検索条件の一覧を読む（失敗・401 は考えない）
  const loadSaved = () => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/search-conditions`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then((rows) => setSaved(rows))
  }

  useEffect(() => {
    if (sessionStorage.getItem('token')) loadSaved()
  }, [])

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
  }, [page, loading, done, searchParams.toString()])

  const togglePref = (pref: string) => {
    const now = form.prefecture ?? []
    setForm({ ...form, prefecture: now.includes(pref) ? now.filter((x: string) => x !== pref) : [...now, pref] })
  }

  const apply = (e: any) => {
    e.preventDefault()
    // 入力を確かめない。年齢の下が上より大きくても、そのまま送る
    sessionStorage.setItem('searchConditions', JSON.stringify(form))
    // 04b：URL に条件を出す。履歴が1つ増えるので、「戻る」で前の条件に戻れる
    setSearchParams(toQuery(form))
    setOpen(false)
    document.querySelector('.frame-main')?.scrollTo(0, 0)
  }

  // 04b：保存した検索条件を使えるか。有料かどうかの判断を、ここにもコピーした（is_paid だけを見る）
  const lockedCondition = (c: any) => locked && (c.conditions?.height_min || c.conditions?.height_max)

  // 04b：保存した検索条件を押したら、その条件で探す（FR-UI-044）。使えない条件はモーダルを出す（FR-UI-048）
  const useSaved = (c: any) => {
    if (lockedCondition(c)) {
      setUpsell(true)
      return
    }
    sessionStorage.setItem('searchConditions', JSON.stringify(c.conditions))
    setSearchParams(toQuery(c.conditions))
    setOpen(false)
    document.querySelector('.frame-main')?.scrollTo(0, 0)
  }

  // 04b：「この条件を保存」。5件あるかは、画面が持っている一覧の数で見る（ほかの端末で足した分は知らない）
  const startSaving = () => {
    if (saved.length >= 5) {
      toast('保存できるのは5件までです。どれかを消してください', 'error')
      return
    }
    setName('')
    setNaming(true)
  }

  const save = () => {
    // 確かめるのは空かどうかだけ（長さは見ない。API も見ない）
    if (!name) {
      toast('名前を入れてください', 'error')
      return
    }
    // 絞り込みの欄の値を、そのまま送る（数も文字のまま。空の欄は空の文字のまま）
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/search-conditions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name, conditions: form }),
    }).then((r) => {
      setNaming(false)
      if (r.status === 403) {
        setUpsell(true)
        return
      }
      if (r.status === 422) {
        toast('保存できるのは5件までです。どれかを消してください', 'error')
        return
      }
      if (!r.ok) {
        toast('保存できませんでした', 'error')
        return
      }
      toast('保存しました')
      loadSaved()
    })
  }

  const rename = () => {
    if (!name) {
      toast('名前を入れてください', 'error')
      return
    }
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/search-conditions/${renaming.public_id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
      },
      body: JSON.stringify({ name }),
    }).then((r) => {
      setRenaming(null)
      if (!r.ok) {
        toast('直せませんでした', 'error')
        return
      }
      toast('名前を直しました')
      loadSaved()
    })
  }

  const remove = () => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me/search-conditions/${deleting.public_id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    }).then((r) => {
      setDeleting(null)
      if (!r.ok) {
        toast('消せませんでした', 'error')
        return
      }
      toast('消しました')
      loadSaved()
    })
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
          <Button type="submit">この条件で探す</Button>
          {/* 04b：今の欄の条件に、名前を付けて保存する（FR-UI-045） */}
          <Button type="button" variant="ghost" onClick={startSaving}>
            この条件を保存
          </Button>
        </form>
      )}

      {/* 04b：保存した検索条件。押すと、その条件で探す（FR-UI-044） */}
      {saved.length > 0 && (
        <div className="saved-list">
          {saved.map((c) => (
            <span key={c.public_id} className="saved-item">
              <button type="button" className="chip saved-chip" onClick={() => useSaved(c)}>
                {c.name}
                {lockedCondition(c) && <span className="paid-mark">有料</span>}
              </button>
              {managing && (
                <>
                  <button
                    type="button"
                    className="saved-action"
                    onClick={() => {
                      setName(c.name)
                      setRenaming(c)
                    }}
                  >
                    名前を直す
                  </button>
                  <button type="button" className="saved-action saved-danger" onClick={() => setDeleting(c)}>
                    消す
                  </button>
                </>
              )}
            </span>
          ))}
          <button type="button" className="saved-action" onClick={() => setManaging(!managing)}>
            {managing ? '終わる' : '編集'}
          </button>
        </div>
      )}

      {!loading && users.length === 0 && (
        <div className="empty">
          <p className="empty-text">条件に合う相手がいません</p>
          <Button small onClick={() => setOpen(true)}>
            条件を変える
          </Button>
        </div>
      )}
      {/* 03c：最初の読み込みは、カードと同じ形のスケルトン（FR-UI-025） */}
      {loading && users.length === 0 && <SkeletonCards />}

      <ul className="user-grid">
        {users.map((u) => (
          // 続きで同じ人が2回来ると、key が重なる（React が警告を出す）
          <li key={u.public_id}>
            {/* 03c：写真に会員ごとの名前を付け、相手のプロフィールの写真へ大きくなってつながる（FR-UI-029） */}
            <Link to={`/users/${u.public_id}`} viewTransition className="user-card">
              <span className="user-card-photo" style={{ viewTransitionName: `photo-${u.public_id}` }}>
                {u.profile?.image ? (
                  <img className="photo-img" src={`${api}${u.profile.image}`} alt="" />
                ) : (
                  <span className="photo-empty">{(u.profile?.nickname ?? '?').slice(0, 1)}</span>
                )}
              </span>
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

      {loading && users.length > 0 && <p className="soon">読み込み中…</p>}
      {done && users.length > 0 && <p className="soon">これで全員です</p>}
      <UpsellDialog open={upsell} onClose={() => setUpsell(false)} />
      <ConfirmDialog
        open={naming}
        title="この条件を保存"
        confirmLabel="保存する"
        onConfirm={save}
        onClose={() => setNaming(false)}
      >
        <label className="label">
          名前（例：東京・20代）
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={renaming !== null}
        title="名前を直す"
        confirmLabel="直す"
        onConfirm={rename}
        onClose={() => setRenaming(null)}
      >
        <label className="label">
          名前
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={`「${deleting?.name}」を消しますか？`}
        confirmLabel="消す"
        danger
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        <p>保存した検索条件を消します。元に戻せません。</p>
      </ConfirmDialog>
    </div>
  )
}
