import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from './components/Button'
import { SkeletonCards } from './components/Skeleton'
import UpsellDialog from './components/UpsellDialog'

// レガシー版（04）。検索のタブ（/search）＝条件で相手を探して、2列のカードで見る。
// 条件・取る・続き・見せるを、全部この部品に書く（03b と同じ形）。
// 04b：今の条件を URL のクエリ（/search?age_min=20…）に出す。
// #147：条件の欄と保存した検索条件は、条件の画面（SearchConditionsPage。/search/conditions）に移した。ここは結果だけ。

// 04b：URL のクエリを、条件の形に直す。値は確かめない（/search?age_min=abc も、そのまま API に送る）
const fromQuery = (q: URLSearchParams) => {
  const c: any = {}
  if (q.get('age_min')) c.age_min = q.get('age_min')
  if (q.get('age_max')) c.age_max = q.get('age_max')
  if (q.get('height_min')) c.height_min = q.get('height_min')
  if (q.get('height_max')) c.height_max = q.get('height_max')
  if (q.getAll('prefecture').length > 0) c.prefecture = q.getAll('prefecture')
  // #153：プロフィールの6項目
  for (const key of ['body_type', 'job', 'income', 'smoking', 'drinking', 'marital_status']) {
    if (q.getAll(key).length > 0) c[key] = q.getAll(key)
  }
  // #150：有料の4つ
  if (q.get('last_login')) c.last_login = q.get('last_login')
  if (q.get('new_member')) c.new_member = q.get('new_member')
  if (q.get('keyword')) c.keyword = q.get('keyword')
  if (q.get('sort')) c.sort = q.get('sort')
  return c
}

// 04b：条件を URL のクエリに直す。API に送るクエリ（load の中）と、ほぼ同じものをもう一度書いた
const toQuery = (c: any) => {
  const q = new URLSearchParams()
  if (c?.age_min) q.append('age_min', c.age_min)
  if (c?.age_max) q.append('age_max', c.age_max)
  if (c?.height_min) q.append('height_min', c.height_min)
  if (c?.height_max) q.append('height_max', c.height_max)
  for (const pref of c?.prefecture ?? []) q.append('prefecture', pref)
  // #153：プロフィールの6項目
  for (const key of ['body_type', 'job', 'income', 'smoking', 'drinking', 'marital_status']) {
    for (const value of c?.[key] ?? []) q.append(key, value)
  }
  // #150：有料の4つ
  if (c?.last_login) q.append('last_login', c.last_login)
  if (c?.new_member) q.append('new_member', c.new_member)
  if (c?.keyword) q.append('keyword', c.keyword)
  if (c?.sort) q.append('sort', c.sort)
  return q
}

export default function SearchPage() {
  // 04b：今の条件の正は、URL のクエリ。再読み込み・ブックマーク・「戻る」で同じ条件になる（FR-UI-041〜043）
  const [searchParams, setSearchParams] = useSearchParams()
  const conditions: any = fromQuery(searchParams)
  const [users, setUsers] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  // 07：検索の API が 403 を返したときの、誘導のモーダル
  const [upsell, setUpsell] = useState(false)
  const navigate = useNavigate()

  // 1ページ分を取って、今の一覧の後ろに足す。重なっていても、そのまま足す
  const load = (p: number, c: any) => {
    setLoading(true)
    const params = new URLSearchParams()
    // #147：性別は送らない（API が、自分と違う性別を返す）
    if (c.age_min) params.append('age_min', c.age_min)
    if (c.age_max) params.append('age_max', c.age_max)
    if (c.height_min) params.append('height_min', c.height_min)
    if (c.height_max) params.append('height_max', c.height_max)
    for (const pref of c.prefecture ?? []) params.append('prefecture[]', pref)
    // #153：プロフィールの6項目。API には、名前に [] を付けて配列で送る
    for (const key of ['body_type', 'job', 'income', 'smoking', 'drinking', 'marital_status']) {
      for (const value of c[key] ?? []) params.append(`${key}[]`, value)
    }
    // #150：有料の4つ（URL のクエリに直す処理と、同じ並びをもう一度書いた）
    if (c.last_login) params.append('last_login', c.last_login)
    if (c.new_member) params.append('new_member', c.new_member)
    if (c.keyword) params.append('keyword', c.keyword)
    if (c.sort) params.append('sort', c.sort)
    params.append('page', String(p))
    // 読み込み中・失敗・401 は考えない
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/users?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => {
        // 07・#150：有料の条件を残したまま無料になったときなど、API が 403 を返したら、モーダルを出して空にする
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
    // 戻ってくるたびに、1ページ目から読み直す（どこまで見ていたかは覚えない）
    load(1, conditions)
  }, [searchParams.toString()])

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

  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

  return (
    <div>
      <div className="search-head">
        <h1 className="page-title">さがす</h1>
        {/* #147：条件は、条件の画面で選ぶ。今の条件を URL のクエリで渡す */}
        <Link className="button button-small button-ghost" to={`/search/conditions?${searchParams}`}>
          絞り込み
        </Link>
      </div>

      {/* #147：今の条件を1行で見せる（欄は条件の画面にある） */}
      {searchParams.toString() !== '' && (
        <p className="search-summary">
          {[
            conditions.age_min || conditions.age_max ? `${conditions.age_min ?? ''}〜${conditions.age_max ?? ''}歳` : '',
            conditions.height_min || conditions.height_max
              ? `${conditions.height_min ?? ''}〜${conditions.height_max ?? ''}cm`
              : '',
            (conditions.prefecture ?? []).join('・'),
            // #153：プロフィールの6項目
            (conditions.body_type ?? []).join('・'),
            (conditions.job ?? []).join('・'),
            (conditions.income ?? []).join('・'),
            (conditions.smoking ?? []).join('・'),
            (conditions.drinking ?? []).join('・'),
            (conditions.marital_status ?? []).join('・'),
            // #150：有料の4つ。言葉の対応を、条件の画面のプルダウンとは別に、ここにも書いた
            conditions.last_login === '24h' ? '24時間以内にログイン' : '',
            conditions.last_login === '3d' ? '3日以内にログイン' : '',
            conditions.last_login === '7d' ? '1週間以内にログイン' : '',
            conditions.new_member ? '登録して1週間以内' : '',
            conditions.keyword ? `「${conditions.keyword}」` : '',
            conditions.sort === 'new' ? '登録が新しい順' : '',
          ]
            .filter((x) => x)
            .join(' ／ ')}
        </p>
      )}

      {!loading && users.length === 0 && (
        <div className="empty">
          <p className="empty-text">条件に合う相手がいません</p>
          <Button small onClick={() => navigate(`/search/conditions?${searchParams}`)}>
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
    </div>
  )
}
