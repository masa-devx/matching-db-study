import {
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Loader,
  NumberInput,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toDate } from '../../date'
import { PaidBadge } from './paid'

// A1（#218）：都道府県の一覧（会員の側の画面にある一覧を、管理画面にもコピーした）
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

// 絞り込みの項目（URL のクエリの名前。API のクエリの名前と同じ）。足すときは、ここと、下の欄と、API の3か所を直す
const KEYS = [
  'q',
  'plan',
  'status',
  'gender',
  'age_min',
  'age_max',
  'prefecture',
  'registered_from',
  'registered_to',
  'last_login',
  'unverified',
  'id',
  'sort',
]
// 「くわしい条件」に入れる項目（#224 で、よく使う 語・有料の区分・状態 を前に出し、残りを畳んだ）
const DETAIL_KEYS = [
  'gender',
  'age_min',
  'age_max',
  'prefecture',
  'registered_from',
  'registered_to',
  'last_login',
  'unverified',
  'id',
]

// 今かかっている条件を、短い言葉にする（条件の札に出す）。値の名前を、欄とは別に、ここにも書いた
const describe = (key: string, value: string): string => {
  const names: Record<string, Record<string, string>> = {
    plan: { free: '無料', paid: '有料（期限の中）', expiring: 'もうすぐ切れる', expired: '期限が過ぎた' },
    status: { suspended: '停止中', withdrawn: '退会', banned: '強制退会', paid: '有料の印あり' },
    gender: { male: '男性', female: '女性' },
    last_login: { '7d': '7日以内にログイン', '30d': '30日以内にログイン', none: '30日より前・一度もなし' },
  }
  if (names[key]) return names[key][value] ?? value
  if (key === 'q') return `「${value}」`
  if (key === 'age_min') return `${value}歳から`
  if (key === 'age_max') return `${value}歳まで`
  if (key === 'registered_from') return `登録 ${value} から`
  if (key === 'registered_to') return `登録 ${value} まで`
  if (key === 'unverified') return 'メールアドレスが未確認'
  if (key === 'id') return `ID ${value.slice(0, 8)}…`
  return value
}

// 12 会員の一覧（FR-ADMIN-004）。50人ずつ（API は offset）。
// A1（#208）：絞り込みとページは、URL のクエリに持つ（詳細から「戻る」で、同じ所に戻る）。
// A1（#218）：絞り込みを増やした。A1（#224）：有料の区分で分け、欄を整理した
export default function MembersPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? '1')
  // 欄に打っている途中の値。「絞り込む」を押したときに、URL に移す
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])),
  )
  // くわしい条件を開いているか。URL に、くわしい条件が入っていれば、最初から開く
  const [open, setOpen] = useState(DETAIL_KEYS.some((k) => params.get(k)))
  const [data, setData] = useState<any>(null)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  // 空の値と、既定の値（1ページ目）は、URL に出さない
  const apply = (next: Record<string, string>, nextPage = 1) => {
    const merged: Record<string, string> = {}
    for (const k of KEYS) if (next[k]) merged[k] = next[k]
    if (nextPage > 1) merged.page = String(nextPage)
    setParams(merged)
  }
  const set = (key: string, value: string) => setForm({ ...form, [key]: value })
  // 有料の区分・状態・並びは、押したらすぐ絞る。ほかの欄は「絞り込む」を押してから
  const setNow = (key: string, value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    apply(next)
  }
  const active = KEYS.filter((k) => k !== 'sort' && params.get(k))
  const detailCount = DETAIL_KEYS.filter((k) => params.get(k)).length

  // 上の帯の検索窓などから、URL だけが変わったときに、欄の中身を合わせる
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL のクエリが変わったときだけ
  useEffect(() => {
    setForm(Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])))
  }, [params.toString()])

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL のクエリが変わったときだけ読む
  useEffect(() => {
    setData(null)
    fetch(`${api}/api/members?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, params.toString()])

  return (
    <Stack>
      <Title order={2}>会員</Title>
      <Card withBorder radius="md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            apply(form)
          }}
        >
          <Stack gap="sm">
            <Group align="end">
              <TextInput
                label="メールアドレス・ニックネーム"
                placeholder="部分一致"
                w={280}
                value={form.q}
                onChange={(e) => set('q', e.currentTarget.value)}
              />
              <Button type="submit">絞り込む</Button>
              <Button variant="default" onClick={() => setOpen(!open)} aria-expanded={open}>
                くわしい条件{detailCount > 0 ? `（${detailCount}）` : ''} {open ? '▲' : '▼'}
              </Button>
            </Group>
            <Group align="end" gap="xl" style={{ minWidth: 0 }}>
              <div style={{ maxWidth: '100%', minWidth: 0 }}>
                <Text size="sm" fw={500} mb={4}>
                  有料の区分
                </Text>
                <SegmentedControl
                  style={{ maxWidth: '100%', overflowX: 'auto' }}
                  aria-label="有料の区分"
                  value={form.plan || 'all'}
                  onChange={(v) => setNow('plan', v === 'all' ? '' : v)}
                  data={[
                    { value: 'all', label: 'すべて' },
                    { value: 'free', label: '無料' },
                    { value: 'paid', label: '有料' },
                    { value: 'expiring', label: 'もうすぐ切れる' },
                    { value: 'expired', label: '期限が過ぎた' },
                  ]}
                />
              </div>
              <div style={{ maxWidth: '100%', minWidth: 0 }}>
                <Text size="sm" fw={500} mb={4}>
                  状態
                </Text>
                <SegmentedControl
                  style={{ maxWidth: '100%', overflowX: 'auto' }}
                  aria-label="状態"
                  value={form.status || 'all'}
                  onChange={(v) => setNow('status', v === 'all' ? '' : v)}
                  data={[
                    { value: 'all', label: 'すべて' },
                    { value: 'suspended', label: '停止中' },
                    { value: 'withdrawn', label: '退会' },
                    { value: 'banned', label: '強制退会' },
                  ]}
                />
              </div>
            </Group>
            <Collapse expanded={open}>
              <Stack gap="sm" pt="xs">
                <Group align="end">
                  <Select
                    label="性別"
                    w={120}
                    clearable
                    placeholder="すべて"
                    data={[
                      { value: 'male', label: '男性' },
                      { value: 'female', label: '女性' },
                    ]}
                    value={form.gender || null}
                    onChange={(v) => set('gender', v ?? '')}
                  />
                  <NumberInput
                    label="年齢（下）"
                    w={110}
                    min={18}
                    max={120}
                    value={form.age_min === '' ? '' : Number(form.age_min)}
                    onChange={(v) => set('age_min', v === '' ? '' : String(v))}
                  />
                  <NumberInput
                    label="年齢（上）"
                    w={110}
                    min={18}
                    max={120}
                    value={form.age_max === '' ? '' : Number(form.age_max)}
                    onChange={(v) => set('age_max', v === '' ? '' : String(v))}
                  />
                  <Select
                    label="都道府県"
                    w={150}
                    clearable
                    searchable
                    placeholder="すべて"
                    data={PREFECTURES}
                    value={form.prefecture || null}
                    onChange={(v) => set('prefecture', v ?? '')}
                  />
                  <Select
                    label="最終ログイン"
                    w={220}
                    clearable
                    placeholder="すべて"
                    data={[
                      { value: '7d', label: '7日以内' },
                      { value: '30d', label: '30日以内' },
                      { value: 'none', label: '30日より前・一度もなし' },
                    ]}
                    value={form.last_login || null}
                    onChange={(v) => set('last_login', v ?? '')}
                  />
                </Group>
                <Group align="end">
                  <TextInput
                    label="登録日（から）"
                    type="date"
                    value={form.registered_from}
                    onChange={(e) => set('registered_from', e.currentTarget.value)}
                  />
                  <TextInput
                    label="登録日（まで）"
                    type="date"
                    value={form.registered_to}
                    onChange={(e) => set('registered_to', e.currentTarget.value)}
                  />
                  <TextInput
                    label="会員の ID"
                    placeholder="完全一致"
                    w={320}
                    value={form.id}
                    onChange={(e) => set('id', e.currentTarget.value.trim())}
                  />
                  <Checkbox
                    label="メールアドレスが未確認"
                    mb={8}
                    checked={form.unverified === '1'}
                    onChange={(e) => set('unverified', e.currentTarget.checked ? '1' : '')}
                  />
                  <Button type="submit" variant="light">
                    この条件で絞り込む
                  </Button>
                </Group>
              </Stack>
            </Collapse>
          </Stack>
        </form>
      </Card>

      {/* A1（#224）：今かかっている条件を、札で出す。札の × で、その条件だけを外せる */}
      {active.length > 0 && (
        <Group gap="xs" aria-label="今の条件">
          <Text size="sm" c="dimmed">
            今の条件：
          </Text>
          {active.map((k) => (
            <Badge
              key={k}
              variant="light"
              size="lg"
              pr={4}
              rightSection={
                <Button
                  variant="subtle"
                  size="compact-xs"
                  px={4}
                  aria-label={`${describe(k, params.get(k) ?? '')} を外す`}
                  onClick={() => setNow(k, '')}
                >
                  ×
                </Button>
              }
            >
              {describe(k, params.get(k) ?? '')}
            </Badge>
          ))}
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              const empty = Object.fromEntries(KEYS.map((k) => [k, k === 'sort' ? form.sort : '']))
              setForm(empty)
              apply(empty)
            }}
          >
            条件を全部外す
          </Button>
        </Group>
      )}

      <Card withBorder radius="md" padding={0}>
        {!data ? (
          <Loader m="md" />
        ) : data.total === undefined ? (
          <Text c="red" p="md">
            読めませんでした（条件の形が、正しくないかもしれません）
          </Text>
        ) : (
          <>
            <Group justify="space-between" p="md">
              <Text size="sm" c="dimmed">
                全部で {data.total.toLocaleString()} 人
              </Text>
              <Select
                size="xs"
                w={220}
                aria-label="並び"
                allowDeselect={false}
                data={[
                  { value: 'created', label: '登録の新しい順' },
                  { value: 'last_login', label: '最終ログインの新しい順' },
                ]}
                value={form.sort || 'created'}
                onChange={(v) => setNow('sort', v === 'created' ? '' : (v ?? ''))}
              />
            </Group>
            <Table.ScrollContainer minWidth={980}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>ニックネーム</Table.Th>
                    <Table.Th>メールアドレス</Table.Th>
                    <Table.Th>性別・年齢</Table.Th>
                    <Table.Th>有料の区分</Table.Th>
                    <Table.Th>プラン・期限</Table.Th>
                    <Table.Th>状態</Table.Th>
                    <Table.Th>最終ログイン</Table.Th>
                    <Table.Th>登録日</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.map((u: any) => (
                    <Table.Tr
                      key={u.public_id}
                      style={{ cursor: 'pointer' }}
                      tabIndex={0}
                      onClick={() => navigate(`/members/${u.public_id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/members/${u.public_id}`)}
                    >
                      <Table.Td>{u.nickname ?? '―'}</Table.Td>
                      <Table.Td>{u.email}</Table.Td>
                      <Table.Td>
                        {/* 性別の名前を、ここにも書く（決まっていない値は、そのまま出す） */}
                        {u.gender === 'male' ? '男性' : u.gender === 'female' ? '女性' : (u.gender ?? '―')}
                        {u.age !== null && u.age !== undefined && `・${u.age}歳`}
                      </Table.Td>
                      <Table.Td>
                        <PaidBadge state={u.paid_state} />
                      </Table.Td>
                      <Table.Td>
                        {u.paid_state === 'free' ? (
                          <Text c="dimmed">―</Text>
                        ) : (
                          <>
                            {u.plan ?? '―'}・{u.paid_until ? toDate(u.paid_until).toLocaleDateString('ja-JP') : '―'}{' '}
                            まで
                          </>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {u.suspended_at && <Badge color="red">停止中</Badge>}
                          {u.banned_at ? (
                            <Badge color="dark">強制退会</Badge>
                          ) : (
                            u.deleted_at && <Badge color="gray">退会</Badge>
                          )}
                          {!u.email_verified_at && <Badge color="yellow">未確認</Badge>}
                          {!u.suspended_at && !u.deleted_at && u.email_verified_at && <Text c="dimmed">利用中</Text>}
                        </Group>
                      </Table.Td>
                      <Table.Td>{u.last_login_at ? toDate(u.last_login_at).toLocaleDateString('ja-JP') : '―'}</Table.Td>
                      <Table.Td>{toDate(u.created_at).toLocaleDateString('ja-JP')}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {data.total === 0 && (
              <Text c="dimmed" p="md">
                条件に合う会員は、いません
              </Text>
            )}
            <Group justify="center" p="md">
              <Pagination
                total={Math.max(1, Math.ceil(data.total / 50))}
                value={page}
                onChange={(n) => apply(Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])), n)}
              />
            </Group>
          </>
        )}
      </Card>
    </Stack>
  )
}
