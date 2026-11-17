import { Anchor, Badge, Card, Group, Loader, Pagination, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

// 12 監査ログ（FR-ADMIN-011）。サイドバーには owner にだけ出す（API は役割を確かめ忘れている）
const ACTIONS: Record<string, string> = {
  'member.view': '会員の詳細を見た',
  'member.suspend': '会員の利用を止めた',
  'plan.price': 'プランの値段を変えた',
  'report_case.update': '通報の案件の状態を変えた',
}

// A4（#208）：中身（JSON）の項目と値の、画面に出す名前。ここにない項目・値は、そのまま出す
const KEYS: Record<string, string> = {
  reason: '理由',
  status: '状態',
  action: '何をしたか',
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
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    setData(null)
    fetch(`${api}/api/audit-logs?page=${page}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, page])

  return (
    <Stack>
      <Title order={2}>監査ログ</Title>
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
                    <Table.Td>{new Date(log.created_at).toLocaleString('ja-JP')}</Table.Td>
                    <Table.Td>{log.admin}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{ACTIONS[log.action] ?? log.action}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {/* A4（#208）：対象から、その画面に行ける（名前は、API が返さないので出せない） */}
                      {log.target_type === 'user' ? (
                        <Anchor component={Link} to={`/members/${log.target_id}`} size="sm">
                          会員の詳細へ
                        </Anchor>
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
