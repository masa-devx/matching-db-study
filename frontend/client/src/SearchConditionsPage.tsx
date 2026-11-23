import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError } from './api/ApiError'
import { membersApi } from './api/membersApi'
import { profileApi } from './api/profileApi'
import Button from './components/Button'
import ConfirmDialog from './components/ConfirmDialog'
import { useToast } from './components/Toast'
import UpsellDialog from './components/UpsellDialog'
import { SEARCH_CONDITIONS_KEY } from './shared/session/session'

// レガシー版（#147）。検索の条件の画面（/search/conditions）。
// 検索の画面（SearchPage）の「絞り込み」から来る。条件を選ぶ欄と、保存した検索条件（04b）は、この画面にだけ出す。
// 選んだ条件は、URL のクエリにして検索の画面に渡す。取る・送る・見せるを、全部この部品に書く。

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

// M5（#198）：地方と、上の一覧の何番目から何番目までか（一覧の並びを変えたら、ここの番号も直す）
const REGIONS = [
  { name: '北海道・東北', from: 0, to: 7 },
  { name: '関東', from: 7, to: 14 },
  { name: '中部', from: 14, to: 23 },
  { name: '近畿', from: 23, to: 30 },
  { name: '中国', from: 30, to: 35 },
  { name: '四国', from: 35, to: 39 },
  { name: '九州・沖縄', from: 39, to: 47 },
]

// 年齢のプルダウンに出す数（18〜99）。範囲は、要件（FR-SEARCH-009）からここに書き写した
const AGES: number[] = []
for (let age = 18; age <= 99; age++) AGES.push(age)

// #153：身長のプルダウンに出す数（130〜210cm）
const HEIGHTS: number[] = []
for (let cm = 130; cm <= 210; cm++) HEIGHTS.push(cm)

// #153：プロフィールの項目の選択肢（年収は、#162 で幅のプルダウンにしたので、上の INCOME_BANDS）。名前の文字を、そのまま API に送る。
// 同じ一覧を、ホーム（HomePage）と試しのデータ（ProfileDetailsSeeder）にも書いた
const DETAILS = [
  {
    key: 'body_type',
    label: '体型',
    options: ['スリム', 'やや細め', '普通', '筋肉質', 'ややぽっちゃり', 'ぽっちゃり'],
  },
  {
    key: 'job',
    label: 'お仕事',
    options: [
      '会社員',
      '公務員',
      '経営者・役員',
      '自営業',
      '医療関係',
      'IT 関係',
      '教育関係',
      '接客・販売',
      'クリエイター',
      '学生',
      'その他',
    ],
  },
  { key: 'smoking', label: 'タバコ', options: ['吸わない', 'ときどき吸う', '吸う', '電子タバコ'] },
  { key: 'drinking', label: 'お酒', options: ['飲まない', 'ときどき飲む', '飲む'] },
  { key: 'marital_status', label: '結婚歴', options: ['未婚', '離婚', '死別'] },
]

// #162：年収は「◯◯万円 から ◯◯万円」の幅で選ぶ。API とプロフィールは区分の名前（文字）で持っているので、
// 幅を、当てはまる区分の名前の並びに直してから送る（レガシー版は、文字のままでは大小を比べられない）
const INCOME_BANDS = [
  { name: '300万円未満', low: 0, high: 300 },
  { name: '300〜500万円', low: 300, high: 500 },
  { name: '500〜700万円', low: 500, high: 700 },
  { name: '700〜1000万円', low: 700, high: 1000 },
  { name: '1000万円以上', low: 1000, high: 9999 },
]
const INCOME_STEPS = [300, 500, 700, 1000]

// 下限と上限（万円。空の文字は「なし」）から、区分の名前の並びを作る
const incomeBands = (min: string, max: string): string[] => {
  if (!min && !max) return []
  const low = min ? Number(min) : 0
  const high = max ? Number(max) : 9999
  return INCOME_BANDS.filter((b) => b.low >= low && b.high <= high).map((b) => b.name)
}

// 区分の名前の並びから、下限と上限を読む（とびとびに選んだ古い条件は、いちばん下からいちばん上までの幅で見せる）
const incomeRange = (names: string[]) => {
  const bands = INCOME_BANDS.filter((b) => names.includes(b.name))
  if (bands.length === 0) return { min: '', max: '' }
  const low = Math.min(...bands.map((b) => b.low))
  const high = Math.max(...bands.map((b) => b.high))
  return { min: low === 0 ? '' : String(low), max: high === 9999 ? '' : String(high) }
}

// SearchPage からコピーした（配列のはずの項目に、文字や数が入っていても回せるようにする。#159）
const asList = (value: any): string[] => {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.map((x) => String(x)) : [String(value)]
}

// SearchPage からコピーした（URL のクエリを、条件の形に直す）
const fromQuery = (q: URLSearchParams) => {
  const c: any = {}
  if (q.get('age_min')) c.age_min = q.get('age_min')
  if (q.get('age_max')) c.age_max = q.get('age_max')
  if (q.get('height_min')) c.height_min = q.get('height_min')
  if (q.get('height_max')) c.height_max = q.get('height_max')
  if (q.getAll('prefecture').length > 0) c.prefecture = q.getAll('prefecture')
  // #153：プロフィールの6項目（どれも、いくつでも選べる）
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

// SearchPage からコピーした（条件を URL のクエリに直す）
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

export default function SearchConditionsPage() {
  // 検索の画面から、今の条件を URL のクエリでもらう
  const [searchParams] = useSearchParams()
  // #159：プルダウンの選択肢にない値（URL の age_min=17 や height_min=165.5）は、欄に入れない。
  // 入れると、プルダウンは「下限なし」に見えるのに、その値がそのまま送られる
  const fromUrl: any = fromQuery(searchParams)
  for (const key of ['age_min', 'age_max']) {
    if (fromUrl[key] && !AGES.map(String).includes(fromUrl[key])) delete fromUrl[key]
  }
  for (const key of ['height_min', 'height_max']) {
    if (fromUrl[key] && !HEIGHTS.map(String).includes(fromUrl[key])) delete fromUrl[key]
  }
  const [form, setForm] = useState<any>(fromUrl)
  // 04b：保存した検索条件（サーバーに5件まで）と、そのモーダル
  const [saved, setSaved] = useState<any[]>([])
  const [managing, setManaging] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<any>(null)
  const [deleting, setDeleting] = useState<any>(null)
  // #162：一覧を読み終わったか（読み終わるまでは、「まだありません」を出さない。出すと、あとで一覧に替わって下のカードが動く）
  const [savedLoaded, setSavedLoaded] = useState(false)
  // #162：条件を直している保存した検索条件（B4）。入っているあいだ、下のボタンが「上書き保存」になる
  const [editingSaved, setEditingSaved] = useState<any>(null)
  // #162：送っているあいだは、ボタンを押せなくする（続けて押すと、2件入っていた）
  const [sending, setSending] = useState(false)
  // 07・#150：自分が男性の無料の会員か（有料の4つの条件を使えない）と、誘導のモーダル
  // 読み終わるまでは null（印も欄も出さない。先に欄を出すと、無料の会員に有料の欄が一瞬見える）
  const [locked, setLocked] = useState<any>(null)
  const [upsell, setUpsell] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  // 04b：保存した検索条件の一覧を読む（失敗は考えない。401 は client.ts が移す）
  const loadSaved = () => {
    membersApi.searchConditions().then((rows) => {
      setSaved(rows)
      setSavedLoaded(true)
    })
  }

  useEffect(() => {
    loadSaved()
    // 07：男性の無料の会員かを知るために、自分と自分のプロフィールを読む（ホームと同じ2本を、ここにも書いた）
    profileApi
      .accountRecord()
      .then((u) => profileApi.member(u.public_id))
      .then((u) => setLocked(u.profile?.gender === 'male' && !u.is_paid))
  }, [])

  // 都道府県と、プロフィールの6項目の、選ぶ・外す（どれも、選んだ名前の配列で持つ）
  const toggle = (key: string, value: string) => {
    const now = asList(form[key])
    setForm({ ...form, [key]: now.includes(value) ? now.filter((x: string) => x !== value) : [...now, value] })
  }

  // 条件を URL のクエリにして、検索の画面に戻る。この画面の履歴は入れ替えるので、
  // 検索の画面でブラウザの「戻る」を押すと、前の条件の結果に戻る（FR-UI-043）
  const search = (c: any) => {
    sessionStorage.setItem(SEARCH_CONDITIONS_KEY, JSON.stringify(c))
    navigate(`/search?${toQuery(c)}`, { replace: true })
  }

  const apply = (e: any) => {
    e.preventDefault()
    // 入力を確かめない。年齢の下が上より大きくても、そのまま送る
    search(form)
  }

  // 04b：保存した検索条件を使えるか。有料かどうかの判断を、ここにもコピーした（is_paid だけを見る）
  // #150：有料の条件が、身長から4つ（最終ログイン・登録して間もない会員・フリーワード・登録が新しい順）に変わった
  const paidCondition = (c: any) =>
    c.conditions?.last_login || c.conditions?.new_member || c.conditions?.keyword || c.conditions?.sort === 'new'
  const lockedCondition = (c: any) => locked && paidCondition(c)

  // #162：無料の会員の欄に、有料の条件が残っているか（有料のときに探した条件・URL から来た条件）。
  // 欄は出さないので、何が残っているかを言葉で見せて、自分で外してもらう（黙って外して探すことはしない）
  const leftPaid = [
    form.last_login === '24h' ? '最終ログイン：24時間以内' : '',
    form.last_login === '3d' ? '最終ログイン：3日以内' : '',
    form.last_login === '7d' ? '最終ログイン：1週間以内' : '',
    form.new_member ? '登録して1週間以内の会員だけ' : '',
    form.keyword ? `フリーワード：${form.keyword}` : '',
    form.sort === 'new' ? '並び替え：登録が新しい順' : '',
  ].filter((x) => x)
  const removePaid = () => {
    const next = { ...form }
    delete next.last_login
    delete next.new_member
    delete next.keyword
    delete next.sort
    setForm(next)
  }

  // #162：条件の画面を直接開いたとき（別のタブ・再読み込み・ブックマーク）は、前の履歴がないので、一覧へ移る
  const back = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
    } else {
      navigate(`/search?${searchParams}`, { replace: true })
    }
  }

  // #162：保存した検索条件の中身を直す（B4）。条件を欄に入れ、下のボタンで上書き保存する
  const startEditing = (c: any) => {
    setForm({ ...(c.conditions ?? {}) })
    setEditingSaved(c)
    setManaging(false)
    document.querySelector('.frame-main')?.scrollTo(0, 0)
  }
  const overwrite = () => {
    setSending(true)
    membersApi.updateSearchCondition(editingSaved.public_id, { conditions: form }).then(
      () => {
        setSending(false)
        toast(`「${editingSaved.name}」の条件を直しました`)
        setEditingSaved(null)
        loadSaved()
      },
      (e) => {
        if (!(e instanceof ApiError)) throw e
        setSending(false)
        toast('直せませんでした', 'error')
      },
    )
  }

  // 04b：保存した検索条件を押したら、その条件で探す（FR-UI-044）。使えない条件はモーダルを出す（FR-UI-048）
  const useSaved = (c: any) => {
    if (lockedCondition(c)) {
      setUpsell(true)
      return
    }
    // #159：有料かどうかを読み終わる前（locked が null）は、有料の条件の入ったものでは探さない（読み終わってから、もう一度押してもらう）
    if (locked === null && paidCondition(c)) {
      return
    }
    search(c.conditions ?? {})
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
    // 欄の値を、そのまま送る（数も文字のまま）
    setSending(true)
    membersApi.createSearchCondition(name, form).then(
      () => {
        setSending(false)
        setNaming(false)
        toast('保存しました')
        loadSaved()
      },
      (e) => {
        if (!(e instanceof ApiError)) throw e
        setSending(false)
        setNaming(false)
        if (e.status === 403) {
          setUpsell(true)
          return
        }
        if (e.status === 422) {
          toast('保存できるのは5件までです。どれかを消してください', 'error')
          return
        }
        toast('保存できませんでした', 'error')
      },
    )
  }

  const rename = () => {
    if (!name) {
      toast('名前を入れてください', 'error')
      return
    }
    setSending(true)
    membersApi.updateSearchCondition(renaming.public_id, { name }).then(
      () => {
        setSending(false)
        setRenaming(null)
        toast('名前を直しました')
        loadSaved()
      },
      (e) => {
        if (!(e instanceof ApiError)) throw e
        setSending(false)
        setRenaming(null)
        toast('直せませんでした', 'error')
      },
    )
  }

  const remove = () => {
    setSending(true)
    membersApi.deleteSearchCondition(deleting.public_id).then(
      () => {
        setSending(false)
        setDeleting(null)
        toast('消しました')
        loadSaved()
      },
      (e) => {
        if (!(e instanceof ApiError)) throw e
        setSending(false)
        setDeleting(null)
        toast('消せませんでした', 'error')
      },
    )
  }

  return (
    <div className="cond-page">
      <div className="search-head">
        <h1 className="page-title">検索条件</h1>
        <button className="button button-small button-ghost" onClick={back}>
          戻る
        </button>
      </div>

      {/* 04b：保存した検索条件。押すと、その条件で探す（FR-UI-044） */}
      <section className="card cond-card">
        <div className="cond-head">
          <h2 className="section-title">保存した検索条件</h2>
          {saved.length > 0 && (
            <button
              type="button"
              className="saved-action"
              aria-pressed={managing}
              onClick={() => setManaging(!managing)}
            >
              {managing ? '終わる' : '編集'}
            </button>
          )}
        </div>
        {/* #162：読み終わるまでは、高さだけを取っておく（あとで中身が出ても、下のカードが動かない） */}
        {!savedLoaded && <div className="cond-placeholder" aria-hidden="true" />}
        {savedLoaded && saved.length === 0 && (
          <p className="cond-note">まだありません。下で条件を選んで「保存」を押すと、ここに出ます（5件まで）。</p>
        )}
        {savedLoaded && saved.length > 0 && (
          <p className="cond-note">
            押すと、その条件で探します。{managing && '「条件を直す」で、中身を欄に入れて直せます。'}（{saved.length}
            ／5件）
          </p>
        )}
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
                    aria-label={`「${c.name}」の名前を直す`}
                    onClick={() => {
                      setName(c.name)
                      setRenaming(c)
                    }}
                  >
                    名前を直す
                  </button>
                  <button
                    type="button"
                    className="saved-action"
                    aria-label={`「${c.name}」の条件を直す`}
                    onClick={() => startEditing(c)}
                  >
                    条件を直す
                  </button>
                  <button
                    type="button"
                    className="saved-action saved-danger"
                    aria-label={`「${c.name}」を消す`}
                    onClick={() => setDeleting(c)}
                  >
                    消す
                  </button>
                </>
              )}
            </span>
          ))}
        </div>
      </section>

      <form onSubmit={apply}>
        {/* #162：保存した検索条件の中身を直しているとき（B4） */}
        {editingSaved && (
          <div className="cond-editing" role="status">
            <span>「{editingSaved.name}」の条件を直しています。下の欄を変えて、「上書き保存」を押してください。</span>
            <button type="button" className="saved-action" onClick={() => setEditingSaved(null)}>
              やめる
            </button>
          </div>
        )}
        {/* #153：まとまりごとにカードを分ける */}
        <section className="card cond-card">
          <h2 className="section-title">基本</h2>
          {/* #147：年齢は、数を打たずにプルダウンで選ぶ（FR-UI-050） */}
          <p className="cond-label">年齢</p>
          <div className="cond-range">
            <select
              className="input"
              aria-label="年齢（下）"
              value={form.age_min ?? ''}
              onChange={(e) => setForm({ ...form, age_min: e.target.value })}
            >
              <option value="">下限なし</option>
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age}歳
                </option>
              ))}
            </select>
            <span className="cond-tilde">〜</span>
            <select
              className="input"
              aria-label="年齢（上）"
              value={form.age_max ?? ''}
              onChange={(e) => setForm({ ...form, age_max: e.target.value })}
            >
              <option value="">上限なし</option>
              {AGES.map((age) => (
                <option key={age} value={age}>
                  {age}歳
                </option>
              ))}
            </select>
          </div>
          {/* #153：身長もプルダウン（FR-UI-055）。#150 から無料 */}
          <p className="cond-label">身長</p>
          <div className="cond-range">
            <select
              className="input"
              aria-label="身長（下）"
              value={form.height_min ?? ''}
              onChange={(e) => setForm({ ...form, height_min: e.target.value })}
            >
              <option value="">下限なし</option>
              {HEIGHTS.map((cm) => (
                <option key={cm} value={cm}>
                  {cm}cm
                </option>
              ))}
            </select>
            <span className="cond-tilde">〜</span>
            <select
              className="input"
              aria-label="身長（上）"
              value={form.height_max ?? ''}
              onChange={(e) => setForm({ ...form, height_max: e.target.value })}
            >
              <option value="">上限なし</option>
              {HEIGHTS.map((cm) => (
                <option key={cm} value={cm}>
                  {cm}cm
                </option>
              ))}
            </select>
          </div>
          {/* #153：都道府県は47個あるので、閉じておき、開いて選ぶ。選んだ名前は、閉じていても見える */}
          <p className="cond-label" id="cond-prefecture">
            住んでいる所
          </p>
          <details className="cond-details">
            <summary aria-describedby="cond-prefecture">
              {asList(form.prefecture).length > 0 ? asList(form.prefecture).join('・') : '全国（押して選ぶ）'}
            </summary>
            {/* M5（#198）：地方ごとに分け、地方の名前を押すと、その地方をまとめて選ぶ・外す（前は、47個を1つずつ押していた） */}
            {REGIONS.map((region) => {
              const prefs = PREFECTURES.slice(region.from, region.to)
              const all = prefs.every((pref) => asList(form.prefecture).includes(pref))
              return (
                <div key={region.name} className="pref-region">
                  <button
                    type="button"
                    className={all ? 'pref-region-name is-on' : 'pref-region-name'}
                    aria-pressed={all}
                    aria-label={`${region.name}を、まとめて${all ? '外す' : '選ぶ'}`}
                    onClick={() => {
                      const others = asList(form.prefecture).filter((x: string) => !prefs.includes(x))
                      setForm({ ...form, prefecture: all ? others : [...others, ...prefs] })
                    }}
                  >
                    {region.name}
                    <span className="pref-region-all">{all ? 'まとめて外す' : 'まとめて選ぶ'}</span>
                  </button>
                  <div className="pref-list" role="group" aria-label={region.name}>
                    {prefs.map((pref) => (
                      <button
                        type="button"
                        key={pref}
                        className={asList(form.prefecture).includes(pref) ? 'chip chip-on' : 'chip'}
                        aria-pressed={asList(form.prefecture).includes(pref)}
                        onClick={() => toggle('prefecture', pref)}
                      >
                        {pref}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </details>
        </section>

        {/* #153：プロフィールの6項目（無料）。選ばなければ、その項目では絞らない */}
        <section className="card cond-card">
          <h2 className="section-title">プロフィール</h2>
          <p className="cond-note">当てはまるものを、いくつでも選べます。選んだ項目に答えていない相手は出ません。</p>
          {/* #162：年収は、幅で選ぶ（B2）。選んだ幅に当てはまる区分の名前を、条件に入れる */}
          <p className="cond-label">年収</p>
          <div className="cond-range">
            <select
              className="input"
              aria-label="年収（下）"
              value={incomeRange(asList(form.income)).min}
              onChange={(e) => {
                // 下が上より大きくなったら、上を外す（当てはまる区分がなくなり、選んだものが消えて見えるため）
                const max = incomeRange(asList(form.income)).max
                const bands = incomeBands(e.target.value, max)
                setForm({
                  ...form,
                  income: bands.length > 0 || !e.target.value ? bands : incomeBands(e.target.value, ''),
                })
              }}
            >
              <option value="">下限なし</option>
              {INCOME_STEPS.map((n) => (
                <option key={n} value={n}>
                  {n}万円
                </option>
              ))}
            </select>
            <span className="cond-tilde">〜</span>
            <select
              className="input"
              aria-label="年収（上）"
              value={incomeRange(asList(form.income)).max}
              onChange={(e) => {
                const min = incomeRange(asList(form.income)).min
                const bands = incomeBands(min, e.target.value)
                setForm({
                  ...form,
                  income: bands.length > 0 || !e.target.value ? bands : incomeBands('', e.target.value),
                })
              }}
            >
              <option value="">上限なし</option>
              {INCOME_STEPS.map((n) => (
                <option key={n} value={n}>
                  {n}万円
                </option>
              ))}
            </select>
          </div>
          {DETAILS.map((d) => (
            <div key={d.key}>
              <p className="cond-label" id={`cond-${d.key}`}>
                {d.label}
              </p>
              <div className="pref-list" role="group" aria-labelledby={`cond-${d.key}`}>
                {d.options.map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={asList(form[d.key]).includes(option) ? 'chip chip-on' : 'chip'}
                    aria-pressed={asList(form[d.key]).includes(option)}
                    onClick={() => toggle(d.key, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* #150：有料の4つ。男性の無料の会員には「有料」の印を出し、押すとモーダル。欄は出さない */}
        <section className="card cond-card">
          <div className="cond-head">
            <h2 className="section-title">こだわり条件 {locked === true && <span className="paid-mark">有料</span>}</h2>
          </div>
          {/* #162：有料かどうかを読み終わるまでは、高さだけを取っておく */}
          {locked === null && <div className="cond-placeholder" aria-hidden="true" />}
          {locked === true && (
            <button type="button" className="paid-lock" onClick={() => setUpsell(true)}>
              最終ログイン・新しい会員・フリーワード・並び替えは、有料会員になると使えます
            </button>
          )}
          {/* #162：無料の会員の欄に、有料の条件が残っているとき（B1）。何が残っているかを見せ、自分で外してもらう */}
          {locked === true && leftPaid.length > 0 && (
            <div className="cond-left-paid" role="status">
              <p className="cond-note">有料の条件が残っています。このままでは探せません。</p>
              <ul className="cond-left-list">
                {leftPaid.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <Button type="button" variant="ghost" onClick={removePaid}>
                有料の条件を外す
              </Button>
            </div>
          )}
          {locked === false && (
            <div className="paid-fields">
              <label className="label">
                最終ログイン
                <select
                  className="input"
                  value={form.last_login ?? ''}
                  onChange={(e) => setForm({ ...form, last_login: e.target.value })}
                >
                  <option value="">指定しない</option>
                  <option value="24h">24時間以内</option>
                  <option value="3d">3日以内</option>
                  <option value="7d">1週間以内</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!form.new_member}
                  onChange={(e) => setForm({ ...form, new_member: e.target.checked ? '1' : '' })}
                />
                登録して1週間以内の会員だけ
              </label>
              <label className="label">
                フリーワード（自己紹介・ニックネーム）
                <input
                  className="input"
                  value={form.keyword ?? ''}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                />
              </label>
              <label className="label">
                並び替え
                <select
                  className="input"
                  value={form.sort ?? ''}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                >
                  <option value="">ログインが新しい順</option>
                  <option value="new">登録が新しい順</option>
                </select>
              </label>
            </div>
          )}
        </section>

        <button type="button" className="cond-reset" onClick={() => setForm({})}>
          条件を全部外す
        </button>

        {/* #153：主なボタンは、画面の下に固定する。保存（小さめ）と、探す（大きめ）を横に並べ、間を空ける */}
        <div className="cond-footer">
          {editingSaved ? (
            <Button type="button" variant="ghost" className="cond-save" loading={sending} onClick={overwrite}>
              上書き保存
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="cond-save" onClick={startSaving}>
              保存
            </Button>
          )}
          <Button type="submit" className="cond-submit">
            この条件で探す
          </Button>
        </div>
      </form>

      <UpsellDialog open={upsell} onClose={() => setUpsell(false)} />
      <ConfirmDialog
        open={naming}
        title="この条件を保存"
        confirmLabel="保存する"
        busy={sending}
        onConfirm={save}
        onClose={() => setNaming(false)}
      >
        <label className="label">
          名前（例：東京・20代）
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // #162：Enter でも保存できるようにする（変換の確定の Enter は除く）
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) save()
            }}
          />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={renaming !== null}
        title="名前を直す"
        confirmLabel="直す"
        busy={sending}
        onConfirm={rename}
        onClose={() => setRenaming(null)}
      >
        <label className="label">
          名前
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) rename()
            }}
          />
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={`「${deleting?.name}」を消しますか？`}
        confirmLabel="消す"
        danger
        busy={sending}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        <p>保存した検索条件を消します。元に戻せません。</p>
      </ConfirmDialog>
    </div>
  )
}
