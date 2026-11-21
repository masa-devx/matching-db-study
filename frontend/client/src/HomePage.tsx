import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from './components/Avatar'
import Button from './components/Button'
import ConfirmDialog from './components/ConfirmDialog'
import Icon from './components/Icon'
import { SkeletonProfile } from './components/Skeleton'
import { useToast } from './components/Toast'
import { apiFetch, apiUrl } from './shared/api/client'
import { useLogout } from './shared/session/useLogout'

// M4（#198）：プルダウンに出す都道府県と身長（検索の条件の画面にある一覧と同じものを、ここにも書いた）
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
const HEIGHTS: number[] = []
for (let cm = 130; cm <= 210; cm++) HEIGHTS.push(cm)

// レガシー版（03b）。ホーム（/home）＝自分のプロフィールを見て直す。全部この部品に書く。
// M1（#181）：有料会員・ブロックした相手・ログアウト・退会は、設定（SettingsPage）に移した。右上の歯車から行く
// #259：ログアウトは、ホームのいちばん下にも置いた（設定を開かずに出られるように。人が決めた）
export default function HomePage() {
  const [me, setMe] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)
  // 03c：保存の結果はトーストで出す（FR-UI-024）
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const { logout: logoutFromServer, loggingOut } = useLogout()
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    // 読み込み中と失敗は考えない。401 は client.ts がログインの画面へ移す。StrictMode なので、開発中は2本ずつ呼ばれる
    // 自分の public_id（#46）を知るために /api/me を呼び、そのあとプロフィールを呼ぶ（2本が順に流れる）
    apiFetch(`/api/me`, {
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((u) =>
        apiFetch(`/api/users/${u.public_id}`, {
          headers: { Accept: 'application/json' },
        }),
      )
      .then((r) => {
        return r.json()
      })
      .then((u) => {
        setMe(u)
        setForm(u.profile ?? {})
      })
  }, [])

  const save = async (e: any) => {
    e.preventDefault()
    // M4：自己紹介が 500文字を超えていたら、送らない
    if ((form.introduction ?? '').length > 500) {
      toast('自己紹介は、500文字までにしてください', 'error')
      return
    }
    setSaving(true)
    // 入力を確かめない。API も確かめないので、何でも入る
    const res = await apiFetch(`/api/users/${me.public_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        nickname: form.nickname,
        prefecture: form.prefecture,
        height: form.height,
        // #153：検索に使う6項目（選ばなければ空の文字。API が null に直す）
        body_type: form.body_type,
        job: form.job,
        income: form.income,
        smoking: form.smoking,
        drinking: form.drinking,
        marital_status: form.marital_status,
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

  // 03c：読み込み中は、中身と同じ形のスケルトン（FR-UI-025）
  // 手順は shared/session/useLogout（設定・確認待ちの画面と同じ）
  const logout = async () => {
    if (await logoutFromServer()) {
      navigate('/login')
      return
    }
    setConfirmLogout(false)
    toast('ログアウトできませんでした。もう一度お試しください', 'error')
  }

  if (!me) return <SkeletonProfile />

  return (
    <div className="profile">
      {/* M1：設定への入口。押せる場所は 44px（FR-UI-058） */}
      <Link to="/settings" viewTransition className="gear" aria-label="設定">
        <Icon name="settings" />
      </Link>
      {/* A7（#213）：運営からのお知らせ。未読があれば、帯（NoticeBanner）で知らせる。ここは、いつでも開ける入口 */}
      <Link to="/notices" viewTransition className="gear gear-second" aria-label="運営からのお知らせ">
        <Icon name="bell" />
      </Link>
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
        {/* M2（#193）：まだ書いていない項目があれば、書くようにうながす（登録の直後は、ほとんどが空） */}
        {!editing &&
          [
            !me.profile?.image && '写真',
            !me.profile?.prefecture && '都道府県',
            !me.profile?.height && '身長',
            !me.profile?.introduction && '自己紹介',
            !me.profile?.body_type && '体型',
            !me.profile?.job && 'お仕事',
          ].filter((x) => x).length > 0 && (
            <div className="card profile-todo">
              <h2 className="section-title">プロフィールを書きましょう</h2>
              <p className="verify-text">
                書いてある項目が多いほど、検索で見つけてもらいやすくなります。まだ書いていない項目：
                {[
                  !me.profile?.image && '写真',
                  !me.profile?.prefecture && '都道府県',
                  !me.profile?.height && '身長',
                  !me.profile?.introduction && '自己紹介',
                  !me.profile?.body_type && '体型',
                  !me.profile?.job && 'お仕事',
                ]
                  .filter((x) => x)
                  .join('・')}
              </p>
            </div>
          )}
        {!editing ? (
          <>
            <div className="chips">
              {me.profile?.prefecture && <span className="chip">{me.profile.prefecture}</span>}
              {me.profile?.height && <span className="chip">{me.profile.height}cm</span>}
              {/* #153：検索に使う6項目。答えたものだけ出す（相手のプロフィールと同じ並びを、ここにも書いた） */}
              {me.profile?.body_type && <span className="chip">体型：{me.profile.body_type}</span>}
              {me.profile?.job && <span className="chip">お仕事：{me.profile.job}</span>}
              {me.profile?.income && <span className="chip">年収：{me.profile.income}</span>}
              {me.profile?.smoking && <span className="chip">タバコ：{me.profile.smoking}</span>}
              {me.profile?.drinking && <span className="chip">お酒：{me.profile.drinking}</span>}
              {me.profile?.marital_status && <span className="chip">結婚歴：{me.profile.marital_status}</span>}
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
                  <img src={apiUrl(`/images/avatars/demo-${n}.svg`)} />
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
            {/* M4（#198）：都道府県と身長は、プルダウンで選ぶ。前は自由に打つ欄で、「東京」と打つと、検索の「東京都」に出なかった。
                都道府県の一覧を、検索の条件の画面（SearchConditionsPage）から、ここにもコピーした */}
            <label className="label">
              都道府県
              <select
                className="input"
                value={form.prefecture ?? ''}
                onChange={(e) => setForm({ ...form, prefecture: e.target.value })}
              >
                <option value="">選ばない</option>
                {/* 前に自由に打った値（選択肢にない値）は、そのまま1つの選択肢として出す（黙って消さない） */}
                {form.prefecture && !PREFECTURES.includes(form.prefecture) && (
                  <option value={form.prefecture}>{form.prefecture}（前に入れた値）</option>
                )}
                {PREFECTURES.map((pref) => (
                  <option key={pref} value={pref}>
                    {pref}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              身長
              <select
                className="input"
                value={form.height ?? ''}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
              >
                <option value="">選ばない</option>
                {form.height && !HEIGHTS.map(String).includes(String(form.height)) && (
                  <option value={form.height}>{form.height}（前に入れた値）</option>
                )}
                {HEIGHTS.map((cm) => (
                  <option key={cm} value={cm}>
                    {cm}cm
                  </option>
                ))}
              </select>
            </label>
            {/* #153：検索に使う6項目。選択肢の一覧を、条件の画面（SearchConditionsPage）からコピーした */}
            {[
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
              {
                key: 'income',
                label: '年収',
                options: ['300万円未満', '300〜500万円', '500〜700万円', '700〜1000万円', '1000万円以上'],
              },
              { key: 'smoking', label: 'タバコ', options: ['吸わない', 'ときどき吸う', '吸う', '電子タバコ'] },
              { key: 'drinking', label: 'お酒', options: ['飲まない', 'ときどき飲む', '飲む'] },
              { key: 'marital_status', label: '結婚歴', options: ['未婚', '離婚', '死別'] },
            ].map((d) => (
              <label className="label" key={d.key}>
                {d.label}
                <select
                  className="input"
                  value={form[d.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [d.key]: e.target.value })}
                >
                  <option value="">回答しない</option>
                  {d.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="label">
              自己紹介
              <textarea
                className="input"
                rows={5}
                value={form.introduction ?? ''}
                onChange={(e) => setForm({ ...form, introduction: e.target.value })}
              />
              {/* M4：文字の数（500文字まで。FR-009。止めるのは画面だけで、API は止めない） */}
              <span className={(form.introduction ?? '').length > 500 ? 'hint is-over' : 'hint'}>
                {(form.introduction ?? '').length}／500文字
              </span>
            </label>
            <Button type="submit" loading={saving}>
              保存する
            </Button>
            <Button
              variant="ghost"
              className="button-space"
              onClick={() => {
                // M4：やめたら、打ちかけの中身を捨てて、保存してある値に戻す（前は、もう一度開くと、打ちかけが残っていた）
                setForm(me.profile ?? {})
                setEditing(false)
              }}
            >
              やめる
            </Button>
          </form>
        )}
        {/* 直している間は出さない（「やめる」と並んで、押し間違えないように） */}
        {!editing && (
          <Button variant="ghost" className="button-space" onClick={() => setConfirmLogout(true)}>
            ログアウト
          </Button>
        )}
      </div>

      {/* ログアウトの前に確かめる（FR-UI-023。設定の画面と同じ） */}
      <ConfirmDialog
        open={confirmLogout}
        title="ログアウトしますか？"
        confirmLabel="ログアウトする"
        danger
        busy={loggingOut}
        onConfirm={logout}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  )
}
