import { Badge, Card, Code, Group, Loader, Pagination, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'

// 12 監査ログ（FR-ADMIN-011）。サイドバーには owner にだけ出す（API は役割を確かめ忘れている）
const ACTIONS: Record<string, string> = {
  'member.view': '会員の詳細を見た',
  'member.suspend': '会員の利用を止めた',
  'plan.price': 'プランの値段を変えた',
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
                      {log.target_type}：{log.target_id}
                    </Table.Td>
                    <Table.Td>{log.detail && <Code>{log.detail}</Code>}</Table.Td>
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
