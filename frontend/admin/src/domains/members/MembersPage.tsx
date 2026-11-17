import {
  Badge,
  Button,
  Card,
  Checkbox,
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

// 12 会員の一覧（FR-ADMIN-004）。50人ずつ（API は offset）。
// A1（#208）：絞り込みとページは、URL のクエリに持つ（詳細から「戻る」で、同じ所に戻る）。
// A1（#218）：絞り込みを増やした（性別・年齢・都道府県・登録日・最終ログイン・未確認・会員の ID・並び）
export default function MembersPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? '1')
  // 欄に打っている途中の値。「絞り込む」を押したときに、URL に移す
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ''])),
  )
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
  // 状態と並びは、押したらすぐ絞る。ほかの欄は「絞り込む」を押してから
  const setNow = (key: string, value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    apply(next)
  }
  const used = KEYS.filter((k) => !['q', 'status', 'sort'].includes(k) && params.get(k)).length

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
          <Stack>
            <Group align="end">
              <TextInput
                label="メールアドレス・ニックネーム"
                placeholder="部分一致"
                value={form.q}
                onChange={(e) => set('q', e.currentTarget.value)}
              />
              <SegmentedControl
                value={form.status || 'all'}
                onChange={(v) => setNow('status', v === 'all' ? '' : v)}
                data={[
                  { value: 'all', label: 'すべて' },
                  { value: 'paid', label: '有料' },
                  { value: 'suspended', label: '停止中' },
                  { value: 'withdrawn', label: '退会' },
                  { value: 'banned', label: '強制退会' },
                ]}
              />
            </Group>
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
            </Group>
            <Group align="end">
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
              <Button type="submit">絞り込む</Button>
              <Button
                variant="subtle"
                onClick={() => {
                  const empty = Object.fromEntries(KEYS.map((k) => [k, '']))
                  setForm(empty)
                  apply(empty)
                }}
              >
                条件を全部外す
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
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
                全部で {data.total.toLocaleString()} 人{used > 0 && `（くわしい条件 ${used}つで絞っています）`}
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
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ニックネーム</Table.Th>
                  <Table.Th>メールアドレス</Table.Th>
                  <Table.Th>性別・年齢</Table.Th>
                  <Table.Th>状態</Table.Th>
                  <Table.Th>購入</Table.Th>
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
                      <Group gap={4}>
                        {u.is_paid && <Badge color="grape">有料</Badge>}
                        {u.suspended_at && <Badge color="red">停止中</Badge>}
                        {u.banned_at ? (
                          <Badge color="dark">強制退会</Badge>
                        ) : (
                          u.deleted_at && <Badge color="gray">退会</Badge>
                        )}
                        {!u.email_verified_at && <Badge color="yellow">未確認</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{u.purchases}</Table.Td>
                    <Table.Td>{u.last_login_at ? toDate(u.last_login_at).toLocaleDateString('ja-JP') : '―'}</Table.Td>
                    <Table.Td>{toDate(u.created_at).toLocaleDateString('ja-JP')}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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
