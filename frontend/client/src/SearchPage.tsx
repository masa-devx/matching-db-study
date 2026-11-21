import { useEffect, useState } from 'react'
import { Link, useNavigate, useNavigationType, useSearchParams } from 'react-router'
import Button from './components/Button'
import { SkeletonCards } from './components/Skeleton'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'
import { apiFetch, apiUrl } from './shared/api/client'
import { SEARCH_CONDITIONS_KEY } from './shared/session/session'

// レガシー版（04）。検索のタブ（/search）＝条件で相手を探して、2列のカードで見る。
// 条件・取る・続き・見せるを、全部この部品に書く（03b と同じ形）。
// 04b：今の条件を URL のクエリ（/search?age_min=20…）に出す。
// #147：条件の欄と保存した検索条件は、条件の画面（SearchConditionsPage。/search/conditions）に移した。ここは結果だけ。

// #159：保存した検索条件の中身は、API が確かめないので、配列のはずの項目に文字や数が入っていることがある。
// そのまま for…of で回すと、文字は1文字ずつに分かれ、数は例外になる（画面が真っ白になった）。配列に直してから回す
const asList = (value: any): string[] => {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.map((x) => String(x)) : [String(value)]
}

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
  for (const pref of asList(c?.prefecture)) q.append('prefecture', pref)
  // #153：プロフィールの6項目
  for (const key of ['body_type', 'job', 'income', 'smoking', 'drinking', 'marital_status']) {
    for (const value of asList(c?.[key])) q.append(key, value)
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
  // #162：有料の条件のせいで探せなかったか（「条件に合う相手がいません」と出すと、0人だと読めてしまう）
  const [paidBlocked, setPaidBlocked] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  // M5（#198）：カードから、いいねとスキップ。相手のプロフィール（UserPage）に書いた送り方を、ここにもコピーした。
  // 送ったら、その人を一覧から外す（次に検索しても、いいねした相手・スキップした相手は出ない）
  const act = async (u: any, kind: 'likes' | 'skips') => {
    const r = await apiFetch(`/api/me/${kind}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: u.public_id }),
    })
    // 無料の男性が、いいねの1日10回を超えたときは 403。誘導のモーダルを出す
    if (kind === 'likes' && r.status === 403) {
      setUpsell(true)
      return
    }
    if (!r.ok) {
      toast(kind === 'likes' ? 'いいねできませんでした' : 'スキップできませんでした', 'error')
      return
    }
    setUsers((now) => now.filter((x) => x.public_id !== u.public_id))
    if (kind === 'skips') {
      toast('スキップしました')
      return
    }
    const d = await r.json()
    // マッチの演出は、相手のプロフィールの画面にしかないので、ここでは文だけ
    toast(d.matched ? 'マッチしました。メッセージのタブから話せます' : 'いいねしました')
  }

  // M5：最終ログインの目安。検索の条件（24時間・3日・1週間）と同じ区切りを、ここにも書いた。
  // 一度もログインしていない会員は、登録した日時で見る（API と同じ）
  const lastSeen = (u: any) => {
    const at = u.last_login_at ?? u.created_at
    if (!at) return ''
    const hours = (Date.now() - new Date(at).getTime()) / 3600000
    if (hours <= 24) return '24時間以内'
    if (hours <= 72) return '3日以内'
    if (hours <= 168) return '1週間以内'
    return ''
  }

  // #159：どうやってこの画面に来たか（POP は、ブラウザの「戻る」「進む」と再読み込み）
  const navigationType = useNavigationType()

  // 1ページ分を取って、今の一覧の後ろに足す。重なっていても、そのまま足す
  const load = (p: number, c: any) => {
    setLoading(true)
    const params = new URLSearchParams()
    // #147：性別は送らない（API が、自分と違う性別を返す）
    if (c.age_min) params.append('age_min', c.age_min)
    if (c.age_max) params.append('age_max', c.age_max)
    if (c.height_min) params.append('height_min', c.height_min)
    if (c.height_max) params.append('height_max', c.height_max)
    for (const pref of asList(c.prefecture)) params.append('prefecture[]', pref)
    // #153：プロフィールの6項目。API には、名前に [] を付けて配列で送る
    for (const key of ['body_type', 'job', 'income', 'smoking', 'drinking', 'marital_status']) {
      for (const value of asList(c[key])) params.append(`${key}[]`, value)
    }
    // #150：有料の4つ（URL のクエリに直す処理と、同じ並びをもう一度書いた）
    if (c.last_login) params.append('last_login', c.last_login)
    if (c.new_member) params.append('new_member', c.new_member)
    if (c.keyword) params.append('keyword', c.keyword)
    if (c.sort) params.append('sort', c.sort)
    params.append('page', String(p))
    // 読み込み中・失敗は考えない（401 は client.ts がログインの画面へ移す）
    apiFetch(`/api/users?${params}`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => {
        // 07・#150：有料の条件を残したまま無料になったときなど、API が 403 を返したら、モーダルを出して空にする
        if (r.status === 403) {
          setUpsell(true)
          setPaidBlocked(true)
          return []
        }
        setPaidBlocked(false)
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
    // 04b：URL にクエリがないとき（タブから /search を開いたとき）は、タブの中で覚えた最後の条件に戻す（FR-UI-016）。
    // 履歴を増やさないよう replace で入れ替える。入れ替えると、この useEffect がもう一度動く
    // #159：ブラウザの「戻る」で条件なしの /search に戻ったときは、入れ替えない（入れ替えると、条件なしの結果に戻れない。FR-UI-043）。
    // sessionStorage の中身が壊れていても、画面が止まらないようにする
    let last: any = {}
    try {
      last = JSON.parse(sessionStorage.getItem(SEARCH_CONDITIONS_KEY) ?? '{}') ?? {}
    } catch {
      last = {}
    }
    if (navigationType !== 'POP' && searchParams.toString() === '' && toQuery(last).toString() !== '') {
      setSearchParams(toQuery(last), { replace: true })
      return
    }
    // #159：今見ている条件を、最後の条件として覚える（URL を直接開いた・「戻る」で見た条件も、ほかのタブから戻ったときに残る）
    sessionStorage.setItem(SEARCH_CONDITIONS_KEY, JSON.stringify(conditions))
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
            // #162：片方だけのときは「20歳〜」「〜30歳」。項目の名前を付ける（「普通・その他・吸う」だけでは、何の項目か分からない）
            conditions.age_min || conditions.age_max
              ? `${conditions.age_min ? `${conditions.age_min}歳` : ''}〜${conditions.age_max ? `${conditions.age_max}歳` : ''}`
              : '',
            conditions.height_min || conditions.height_max
              ? `${conditions.height_min ? `${conditions.height_min}cm` : ''}〜${conditions.height_max ? `${conditions.height_max}cm` : ''}`
              : '',
            asList(conditions.prefecture).join('・'),
            asList(conditions.body_type).length > 0 ? `体型：${asList(conditions.body_type).join('・')}` : '',
            asList(conditions.job).length > 0 ? `お仕事：${asList(conditions.job).join('・')}` : '',
            asList(conditions.income).length > 0 ? `年収：${asList(conditions.income).join('・')}` : '',
            asList(conditions.smoking).length > 0 ? `タバコ：${asList(conditions.smoking).join('・')}` : '',
            asList(conditions.drinking).length > 0 ? `お酒：${asList(conditions.drinking).join('・')}` : '',
            asList(conditions.marital_status).length > 0
              ? `結婚歴：${asList(conditions.marital_status).join('・')}`
              : '',
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

      {/* #162：有料の条件のせいで探せなかったとき（B1）。0人のときの文とは分ける。外すのは、会員が自分で押したときだけ */}
      {!loading && paidBlocked && (
        <div className="empty">
          <p className="empty-text">この条件には、有料会員だけが使える条件が入っています</p>
          <Button
            small
            onClick={() => {
              const next: any = { ...conditions }
              delete next.last_login
              delete next.new_member
              delete next.keyword
              delete next.sort
              setSearchParams(toQuery(next), { replace: true })
            }}
          >
            有料の条件を外して探す
          </Button>
        </div>
      )}
      {!loading && users.length === 0 && !paidBlocked && (
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
                  <img className="photo-img" src={apiUrl(u.profile.image)} alt="" />
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
              {/* M5（#198）：登録して1週間以内の印と、最終ログインの目安 */}
              {u.created_at && Date.now() - new Date(u.created_at).getTime() <= 7 * 86400000 && (
                <span className="user-card-new">NEW</span>
              )}
              {lastSeen(u) && <span className="user-card-seen">{lastSeen(u)}</span>}
            </Link>
            {/* M5：カードから、いいねとスキップ（前は、1人ずつプロフィールを開かないと、できなかった） */}
            <div className="user-card-actions">
              <button
                type="button"
                className="card-action"
                aria-label={`${u.profile?.nickname ?? 'この相手'}をスキップする`}
                onClick={() => act(u, 'skips')}
              >
                スキップ
              </button>
              <button
                type="button"
                className="card-action card-action-like"
                aria-label={`${u.profile?.nickname ?? 'この相手'}にいいねする`}
                onClick={() => act(u, 'likes')}
              >
                いいね
              </button>
            </div>
          </li>
        ))}
      </ul>

      {loading && users.length > 0 && <p className="soon">読み込み中…</p>}
      {done && users.length > 0 && <p className="soon">これで全員です</p>}
      <UpsellDialog open={upsell} onClose={() => setUpsell(false)} />
    </div>
  )
}
