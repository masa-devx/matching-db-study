import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toDate } from '../../date'

// 12 監査ログ（FR-ADMIN-011）。サイドバーには owner にだけ出す（API は役割を確かめ忘れている）
const ACTIONS: Record<string, string> = {
  'member.view': '会員の詳細を見た',
  'member.suspend': '会員の利用を止めた',
  'plan.price': 'プランの値段を変えた',
  'report_case.update': '通報の案件の状態を変えた',
  'member.notice': '会員にお知らせを送った',
  'member.ban': '会員を強制退会にした',
}

// A4（#208）：中身（JSON）の項目と値の、画面に出す名前。ここにない項目・値は、そのまま出す
const KEYS: Record<string, string> = {
  reason: '理由',
  status: '状態',
  action: '何をしたか',
  kind: '種類',
  title: '題',
  before: '前の値段',
  after: '新しい値段',
}
const VALUES: Record<string, string> = {
  open: 'まだ',
  in_progress: '対応中',
  closed: '済み',
  none: '問題なし',
  warned: '注意した',
  suspended: '利用を止めた',
  banned: '強制退会にした',
  warning: '注意',
  info: 'お知らせ',
}

// 中身は JSON の文字で届く。項目と値に分ける。JSON でなければ、そのまま出す
function Detail({ text }: { text: string }) {
  let parsed: Record<string, unknown> | null = null
  try {
    const value = JSON.parse(text)
    if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value
  } catch {
    parsed = null
  }
  if (!parsed) return <Text size="sm">{text}</Text>
  return (
    <Stack gap={2}>
      {Object.entries(parsed)
        .filter(([, v]) => v !== null && v !== '')
        .map(([k, v]) => (
          <Text key={k} size="sm">
            <Text span c="dimmed">
              {KEYS[k] ?? k}：
            </Text>
            {VALUES[String(v)] ?? String(v)}
          </Text>
        ))}
    </Stack>
  )
}

export default function AuditLogsPage() {
  // A4（#221）：絞り込み（管理者・操作・対象・期間）。URL のクエリに持つ。会員の一覧に書いた持ち方を、ここにもコピーした
  const FILTERS = ['admin', 'action', 'target', 'from', 'to']
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? '1')
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])),
  )
  const apply = (next: Record<string, string>, nextPage = 1) => {
    const merged: Record<string, string> = {}
    for (const k of FILTERS) if (next[k]) merged[k] = next[k]
    if (nextPage > 1) merged.page = String(nextPage)
    setParams(merged)
  }
  const setPage = (n: number) => apply(Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])), n)
  const [data, setData] = useState<any>(null)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL のクエリが変わったときだけ読む
  useEffect(() => {
    setData(null)
    fetch(`${api}/api/audit-logs?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, params.toString()])

  return (
    <Stack>
      <Title order={2}>監査ログ</Title>
      <Card withBorder radius="md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            apply(form)
          }}
        >
          <Group align="end">
            <TextInput
              label="管理者の名前"
              placeholder="部分一致"
              w={160}
              value={form.admin}
              onChange={(e) => setForm({ ...form, admin: e.currentTarget.value })}
            />
            <Select
              label="操作"
              w={240}
              clearable
              placeholder="すべて"
              data={Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))}
              value={form.action || null}
              onChange={(v) => setForm({ ...form, action: v ?? '' })}
            />
            <TextInput
              label="対象の ID（会員・案件）"
              placeholder="完全一致"
              w={300}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.currentTarget.value.trim() })}
            />
            <TextInput
              label="いつから"
              type="date"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.currentTarget.value })}
            />
            <TextInput
              label="いつまで"
              type="date"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.currentTarget.value })}
            />
            <Button type="submit">絞り込む</Button>
            <Button
              variant="subtle"
              onClick={() => {
                const empty = Object.fromEntries(FILTERS.map((k) => [k, '']))
                setForm(empty)
                apply(empty)
              }}
            >
              外す
            </Button>
          </Group>
        </form>
      </Card>
      <Card withBorder radius="md" padding={0}>
        {!data ? (
          <Loader m="md" />
        ) : (
          <>
            <Text size="sm" c="dimmed" p="md">
              全部で {data.total.toLocaleString()} 件
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>日時</Table.Th>
                  <Table.Th>管理者</Table.Th>
                  <Table.Th>操作</Table.Th>
                  <Table.Th>対象</Table.Th>
                  <Table.Th>中身</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.data.map((log: any) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>{toDate(log.created_at).toLocaleString('ja-JP')}</Table.Td>
                    <Table.Td>{log.admin}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{ACTIONS[log.action] ?? log.action}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {/* A4（#208）：対象から、その画面に行ける（名前は、API が返さないので出せない） */}
                      {log.target_type === 'user' ? (
                        <Group gap={6}>
                          <Anchor component={Link} to={`/members/${log.target_id}`} size="sm">
                            会員の詳細へ
                          </Anchor>
                          {/* A4（#221）：この会員への操作だけに絞る */}
                          <Anchor
                            component="button"
                            type="button"
                            size="xs"
                            c="dimmed"
                            onClick={() => {
                              const next = { ...form, target: log.target_id }
                              setForm(next)
                              apply(next)
                            }}
                          >
                            この対象で絞る
                          </Anchor>
                        </Group>
                      ) : log.target_type === 'report_case' ? (
                        <Anchor component={Link} to={`/reports/${log.target_id}`} size="sm">
                          通報の案件へ
                        </Anchor>
                      ) : (
                        <Text size="sm">
                          {log.target_type}：{log.target_id}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{log.detail && <Detail text={log.detail} />}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="center" p="md">
              <Pagination total={Math.max(1, Math.ceil(data.total / 50))} value={page} onChange={setPage} />
            </Group>
          </>
        )}
      </Card>
    </Stack>
  )
}
