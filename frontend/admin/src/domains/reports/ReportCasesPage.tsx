import { Badge, Card, Group, Loader, Pagination, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toDate } from '../../date'

// A7 通報の案件の一覧（FR-REPORT-010。#203）。通報は、通報された会員ごとの「案件」にまとまる。状態で絞る。20件ずつ
export default function ReportCasesPage() {
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    setData(null)
    const params = new URLSearchParams({ page: String(page) })
    if (status !== 'all') params.set('status', status)
    fetch(`${api}/api/report-cases?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, status, page])

  return (
    <Stack>
      <Title order={2}>通報</Title>
      <Card withBorder radius="md">
        <Group justify="space-between">
          <SegmentedControl
            value={status}
            onChange={(v) => {
              setPage(1)
              setStatus(v)
            }}
            data={[
              { value: 'open', label: 'まだ' },
              { value: 'in_progress', label: '対応中' },
              { value: 'closed', label: '済み' },
              { value: 'all', label: 'すべて' },
            ]}
          />
          {data && <Text c="dimmed">{data.total}件</Text>}
        </Group>
      </Card>

      <Card withBorder radius="md">
        {!data ? (
          <Loader />
        ) : data.data.length === 0 ? (
          <Text c="dimmed">この状態の案件は、ありません</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>通報された会員</Table.Th>
                <Table.Th>状態</Table.Th>
                <Table.Th ta="right">通報の件数</Table.Th>
                <Table.Th ta="right">通報した人数</Table.Th>
                <Table.Th>いちばん新しい通報</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.data.map((c: any) => (
                <Table.Tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  onClick={() => navigate(`/reports/${c.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/reports/${c.id}`)}
                >
                  <Table.Td>
                    <Group gap="xs">
                      {c.member.nickname ?? '―'}
                      {/* 状態の名前と色を、案件の画面にもコピーした */}
                      {c.member.state === 'suspended' && <Badge color="red">停止中</Badge>}
                      {c.member.state === 'withdrawn' && <Badge color="gray">退会</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={c.status === 'open' ? 'red' : c.status === 'in_progress' ? 'yellow' : 'gray'}>
                      {c.status === 'open' ? 'まだ' : c.status === 'in_progress' ? '対応中' : '済み'}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{c.report_count}</Table.Td>
                  <Table.Td ta="right">{c.reporter_count}</Table.Td>
                  <Table.Td>{c.last_reported_at ? toDate(c.last_reported_at).toLocaleString('ja-JP') : '―'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
      {data && data.total > 20 && <Pagination total={Math.ceil(data.total / 20)} value={page} onChange={setPage} />}
    </Stack>
  )
}
